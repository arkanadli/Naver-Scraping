import { CookieJar } from 'tough-cookie';
import type { Logger } from 'pino';
import { getAgent } from './proxy-pool';

const USE_PW = String(process.env.USE_PLAYWRIGHT || 'true') === 'true';
const jar = new CookieJar();

// disimpan untuk Playwright Request API (HTTP tanpa browser UI)
let storageStateJSON: any | null = null;

export async function getCookieHeader(url: string): Promise<string | undefined> {
  const cookies = await jar.getCookieString(url);
  return cookies || undefined;
}

export async function putSetCookie(url: string, setCookieHeader?: string | string[]) {
  if (!setCookieHeader) return;
  const items = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  await Promise.all(items.map(sc => jar.setCookie(sc, url)));
}

export async function ensureSession(logger?: Logger) {
  if (!USE_PW) return;

  const testUrl = 'https://search.shopping.naver.com/ns/search?query=iphone';
  const existing = await jar.getCookies(testUrl);
  if (existing.length > 0 && storageStateJSON) {
    logger?.info({ cookies: existing.length }, 'Cookie jar already seeded, skip');
    return;
  }

  logger?.info('Seeding session cookies via Playwright ...');
  const { chromium } = await import('playwright');

  // ambil proxy dari undici ProxyAgent
  const agent = getAgent() as any;
  const proxyUrl: string | undefined = agent?.opts?.uri?.href || agent?.opts?.uri || undefined;

  let pwProxy: { server: string; username?: string; password?: string } | undefined;
  if (proxyUrl) {
    try {
      const u = new URL(proxyUrl);
      pwProxy = {
        server: `${u.protocol}//${u.hostname}:${u.port}`,
        username: u.username || undefined,
        password: u.password || undefined
      };
    } catch { /* ignore */ }
  }

  const browser = await chromium.launch({ headless: true, proxy: pwProxy });
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: undefined
  });
  const page = await context.newPage();
  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1200);

  // simpan ke tough-cookie
  const cookies = await context.cookies();
  const cookieUrl = 'https://search.shopping.naver.com/';
  for (const c of cookies) {
    const serialized = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}` +
      (c.expires ? `; Expires=${new Date(c.expires * 1000).toUTCString()}` : '') +
      (c.secure ? '; Secure' : '');
    await jar.setCookie(serialized, cookieUrl);
  }

  // simpan storage state buat Playwright Request API
  storageStateJSON = await context.storageState();

  await browser.close();
  logger?.info({ cookies: cookies.length }, 'Session cookies seeded.');
}

// --- Playwright Request fallback (HTTP client milik Playwright) ---
export async function pwFetchJSON(url: string, headers: Record<string, string>) {
  if (!USE_PW) throw new Error('Playwright disabled');
  if (!storageStateJSON) {
    // seed dulu bila belum ada
    await ensureSession();
  }
  const { request } = await import('playwright');

  // siapkan proxy lagi (sinkron dengan undici)
  const agent = getAgent() as any;
  const proxyUrl: string | undefined = agent?.opts?.uri?.href || agent?.opts?.uri || undefined;

  let pwProxy: { server: string; username?: string; password?: string } | undefined;
  if (proxyUrl) {
    try {
      const u = new URL(proxyUrl);
      pwProxy = {
        server: `${u.protocol}//${u.hostname}:${u.port}`,
        username: u.username || undefined,
        password: u.password || undefined
      };
    } catch { /* ignore */ }
  }

  const ctx = await request.newContext({
    proxy: pwProxy,
    extraHTTPHeaders: headers,
    storageState: storageStateJSON
  });

  const resp = await ctx.get(url, { headers, timeout: 30000 });
  const status = resp.status();
  const text = await resp.text();
  await ctx.dispose();

  if (status >= 400) {
    throw new Error(`PW HTTP ${status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
export async function pwFetchViaPage(apiUrl: string): Promise<any> {
    const { chromium } = await import('playwright');
    const agent = getAgent() as any;
    const proxyUrl: string | undefined = agent?.opts?.uri?.href || agent?.opts?.uri || undefined;
  
    let pwProxy: { server: string; username?: string; password?: string } | undefined;
    if (proxyUrl) {
      try {
        const u = new URL(proxyUrl);
        pwProxy = {
          server: `${u.protocol}//${u.hostname}:${u.port}`,
          username: u.username || undefined,
          password: u.password || undefined
        };
      } catch { /* ignore */ }
    }
  
    if (!storageStateJSON) await ensureSession();
  
    // siapkan query untuk membuka referer yang konsisten
    let q = 'iphone';
    let pathAndQuery = '';
    try {
      const u = new URL(apiUrl);
      q = u.searchParams.get('query') || q;
      pathAndQuery = `${u.pathname}?${u.searchParams.toString()}`;
    } catch {
      // fallback: gunakan path dari hardcode endpoint
      pathAndQuery = '/ns/v1/search/paged-composite-cards';
    }
  
    const browser = await chromium.launch({ headless: true, proxy: pwProxy });
    const context = await browser.newContext({
      locale: 'ko-KR',
      storageState: storageStateJSON,
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
  
    const refererUrl = `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(q)}`;
    await page.goto(refererUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
    // Pastikan halaman “tenang” dulu
    try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
  
    // Sedikit interaksi agar anti-bot yang menunggu user event terpenuhi
    await page.mouse.move(200 + Math.random()*200, 300 + Math.random()*200);
    await page.keyboard.press('PageDown').catch(()=>{});
    await page.waitForTimeout(400 + Math.floor(Math.random()*400));
  
    // Panggil API dari dalam halaman (same-origin)
    const result = await page.evaluate(async (p) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
  
      try {
        // kalau p.absolute true, gunakan absolute URL; else pakai relative utk patuh same-origin
        const url = p.absolute
          ? p.apiUrl
          : p.pathAndQuery || p.apiUrl;
  
        const resp = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json, text/plain, */*',
            // Referer otomatis = halaman ini; Origin = same-origin
          }
        });
  
        const ct = resp.headers.get('content-type') || '';
        const text = await resp.text();
  
        if (!resp.ok) {
          return { ok: false, status: resp.status, body: text.slice(0, 400), contentType: ct };
        }
  
        if (ct.includes('application/json')) {
          try { return { ok: true, data: JSON.parse(text) }; }
          catch { return { ok: true, data: text }; }
        }
  
        return { ok: true, data: text };
      } finally {
        clearTimeout(timer);
      }
    }, { apiUrl, pathAndQuery, absolute: false });
  
    await browser.close();
  
    if (!result?.ok) {
      throw new Error(`PW in-page HTTP ${result?.status}: ${result?.body || 'no body'}`);
    }
    return result.data;
  }
  