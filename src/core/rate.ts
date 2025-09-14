import Bottleneck from 'bottleneck';

const MAX = +(process.env.MAX_CONCURRENCY || '6');
export const limiter = new Bottleneck({ maxConcurrent: MAX });

const MIN_DELAY = +(process.env.MIN_DELAY_MS || '120');
const MAX_DELAY = +(process.env.MAX_DELAY_MS || '450');
const RETRY = +(process.env.RETRY || '2');

export function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export function jitterDelay() {
  const span = Math.max(MAX_DELAY - MIN_DELAY, 0);
  return MIN_DELAY + Math.floor(Math.random() * (span + 1));
}

export async function withBackoff<T>(fn: () => Promise<T>, onError?: (err: any, attempt: number) => void): Promise<T> {
  let attempt = 0;
  let delay = jitterDelay();

  while (true) {
    try {
      return await limiter.schedule(fn);
    } catch (e: any) {
      attempt++;
      onError?.(e, attempt);
      if (attempt > RETRY) throw e;

      // Exponential-ish backoff + jitter
      await sleep(delay);
      delay = Math.min(delay * 1.8 + jitterDelay(), 5000);
    }
  }
}
