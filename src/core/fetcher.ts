import { request, Dispatcher } from 'undici';
import type { Logger } from 'pino';
import { buildFingerprintHeadersForApi } from './fingerprint';
import { getAgent, markProxyBad } from './proxy-pool';
import { getCookieHeader, putSetCookie, pwFetchJSON, pwFetchViaPage } from './session';
import { withBackoff, jitterDelay, sleep } from './rate';

const BASE_ORIGIN = 'https://search.shopping.naver.com';

function isRetryable(status: number) {
  return status === 429 || (status >= 500 && status < 600) || status === 418;
}

export async function fetchPagedCards(url: string, logger?: Logger): Promise<any> {
  try { new URL(url); } catch {
    const err: any = new Error('Invalid URL');
    err.code = 'ERR_INVALID_URL';
    err.input = url;
    throw err;
  }

  const start = Date.now();

  return withBackoff(async () => {
    const agent: Dispatcher = getAgent();
    const proxyUrl: string | undefined = (agent as any)?.opts?.uri?.href || (agent as any)?.opts?.uri;

    const headers = buildFingerprintHeadersForApi(url);
    const cookieHeader = await getCookieHeader(BASE_ORIGIN);
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    // 1) Coba via undici (cepat)
    const res = await request(url, {
      method: 'GET',
      headers,
      dispatcher: agent
    });

    await putSetCookie(BASE_ORIGIN, res.headers['set-cookie']);

    const { statusCode } = res;

    if (statusCode === 418 || statusCode === 403) {
        if (proxyUrl) markProxyBad(proxyUrl);
        const preview = await res.body.text();
        logger?.warn({ statusCode, preview: preview.slice(0, 120) }, 'undici blocked; fallback to PlaywrightRequest');
      
        try {
          const viaPW = await pwFetchJSON(url, headers);
          await sleep(jitterDelay());
          logger?.info({ ms: Date.now() - start, proxyUrl, via: 'pw-request' }, 'fetchPagedCards done');
          return viaPW;
        } catch (e) {
          logger?.warn({ msg: String(e) }, 'pw-request blocked; fallback to in-page');
        }
      
        // FINAL: in-page fetch
        const viaPage = await pwFetchViaPage(url);
        await sleep(jitterDelay());
        logger?.info({ ms: Date.now() - start, proxyUrl, via: 'pw-page' }, 'fetchPagedCards done');
        return viaPage;
      }
      

    if (statusCode >= 400) {
      const text = await res.body.text();
      const err = new Error(`HTTP ${statusCode}: ${text.slice(0, 300)}`);
      if (isRetryable(statusCode)) throw err;
      throw err;
    }

    const body = await res.body.json();
    await sleep(jitterDelay());
    logger?.info({ ms: Date.now() - start, proxyUrl, via: 'undici' }, 'fetchPagedCards done');
    return body;

  }, (err, attempt) => {
    logger?.warn({ attempt, msg: String(err) }, 'fetchPagedCards retry');
  });
}
