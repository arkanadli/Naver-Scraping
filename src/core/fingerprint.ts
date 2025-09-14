import { HeaderGenerator } from 'header-generator';
export type HeaderMap = Record<string, string>;

const hg = new HeaderGenerator({
  browsers: [{ name: 'chrome', minVersion: 115 }],
  devices: ['desktop'],
  operatingSystems: ['windows', 'linux']
});

export function buildFingerprintHeadersForApi(apiUrl: string, extra: Partial<HeaderMap> = {}): HeaderMap {
  const base = hg.getHeaders({ httpVersion: '2', locales: ['ko-KR', 'en-US'] });

  // referer sinkron dengan query
  let referer = 'https://search.shopping.naver.com/ns/search';
  try {
    const u = new URL(apiUrl);
    const q = u.searchParams.get('query');
    if (q) referer = `https://search.shopping.naver.com/ns/search?query=${encodeURIComponent(q)}`;
  } catch {}

  const enriched: HeaderMap = {
    ...base,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Origin': 'https://search.shopping.naver.com',
    'Referer': referer,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Accept-Encoding': 'gzip, deflate, br',
    // pastikan ada platform (kadang generator tak selalu isi)
    'sec-ch-ua-platform': '"Windows"'
  };

  Object.entries(extra).forEach(([k, v]) => { if (v !== undefined) enriched[k] = v; });
  return enriched;
}
