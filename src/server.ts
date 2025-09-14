import 'dotenv/config';
import express from 'express';
import pino from 'pino';
import { naverRoute } from './routes/naver';
import { ensureSession } from './core/session';

const logger = pino({ transport: { target: 'pino-pretty' } });
const app = express();

app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/naver', naverRoute(logger));

const PORT = +(process.env.PORT || 3000);

(async () => {
  try {
    // Seed cookie/session sekali di awal (kalau USE_PLAYWRIGHT=true)
    await ensureSession(logger);
    app.listen(PORT, () => logger.info(`Server on :${PORT}`));
  } catch (e) {
    logger.error(e, 'Failed to start');
    process.exit(1);
  }
})();
