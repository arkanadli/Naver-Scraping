import { Router } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { resolveToApiUrl } from '../core/resolve';
import { fetchPagedCards } from '../core/fetcher';

/** Ambil nilai mentah dari originalUrl: semua karakter setelah "url=" sampai akhir */
function extractRawParamFromOriginal(original: string, key: string): string | null {
  const rx = new RegExp(`[?&]${key}=([^]*)`); // ambil semua sisa string
  const m = original.match(rx);
  if (!m) return null;
  // Jika user sudah URL-encode, ini akan berbentuk percent-encoded.
  // Kalau belum, ini tetap string biasa berisi '&' dan lain-lain -> tetap valid utk undici.
  return decodeURIComponent(m[1]);
}

export const naverRoute = (logger: Logger) => {
  const r = Router();

  r.get('/', async (req, res) => {
    try {
      const schema = z.object({
        url: z.string().optional(),        // boleh kosong (karena kita bisa pakai originalUrl)
        productUrl: z.string().url().optional()
      }).refine(v => v.url || v.productUrl, { message: 'Provide url or productUrl' });

      const params = schema.parse(req.query);

      let targetUrl: string;
      if (params.url) {
        // Coba ambil raw dari originalUrl agar tidak terpotong di '&'
        const raw = extractRawParamFromOriginal(req.originalUrl, 'url');
        targetUrl = raw || params.url;
      } else {
        targetUrl = await resolveToApiUrl(params.productUrl!);
      }

      const data = await fetchPagedCards(targetUrl, logger);
      res.json({ ok: true, targetUrl, data });

    } catch (e: any) {
      logger.error(e, 'naver route error');
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  return r;
};
