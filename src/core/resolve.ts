import { ensureSession } from './session';

const BASE_API = 'https://search.shopping.naver.com/ns/v1/search/paged-composite-cards';

// Susun URL paged-composite-cards dari query text
function buildApiUrlFromQuery(query: string) {
  const params = new URLSearchParams({
    cursor: '1',
    pageSize: '50',
    query,
    searchMethod: 'displayCategory.basic',
    isCatalogDiversifyOff: 'true',
    hiddenNonProductCard: 'false',
    hasMoreAd: 'false',
    onlySecondhand: 'false',
    onlyRental: 'false',
    onlyOversea: 'false'
  });
  return `${BASE_API}?${params.toString()}`;
}

function simpleGuessQueryFromProductUrl(productUrl: string): string {
  // Heuristik sederhana: ambil segmen terakhir path (slug/ID)
  try {
    const u = new URL(productUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.pop() || 'iphone';
  } catch {
    return 'iphone';
  }
}

async function queryFromProductWithPlaywright(productUrl: string): Promise<string> {
  // Launch cepat, buka product page, ambil <title> atau text heading sebagai query
  const { chromium } = await import('playwright');
  // Tidak perlu proxy khusus di sini, tapi boleh reuse dari session.ts bila mau.
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });

  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Ambil judul; fallback ke URL heuristik kalau kosong
  const title = (await page.title())?.trim();
  await browser.close();

  if (title && title.length > 2) {
    // Seringkali judul mengandung brand + nama produk -> cukup bagus untuk query
    return title.replace(/\s+/g, ' ').slice(0, 80);
  }
  return simpleGuessQueryFromProductUrl(productUrl);
}

export async function resolveToApiUrl(productUrl: string): Promise<string> {
  const usePw = String(process.env.USE_PLAYWRIGHT || 'true') === 'true';

  if (usePw) {
    await ensureSession(); // pastikan sesi seeded (aman untuk dipanggil berulang)
    const q = await queryFromProductWithPlaywright(productUrl);
    return buildApiUrlFromQuery(q);
  }

  // Fallback tanpa Playwright
  const q = simpleGuessQueryFromProductUrl(productUrl);
  return buildApiUrlFromQuery(q);
}
