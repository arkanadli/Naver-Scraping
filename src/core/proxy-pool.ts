import type { Dispatcher } from 'undici';
import { ProxyAgent, Agent } from 'undici';

export interface ProxyEntry {
  url: string;
  badUntil?: number;
}

const now = () => Date.now();
const PROXY_ENABLED = String(process.env.PROXY_ENABLED ?? 'true') !== 'false';

function envProxyFromCreds(): string {
  const host = process.env.PROXY_HOST;
  const port = process.env.PROXY_PORT;
  const user = process.env.PROXY_USER;
  const pass = process.env.PROXY_PASS;
  if (!(host && port && user && pass)) throw new Error('Missing PROXY_* envs');
  // ⬇ pastikan skema sesuai jenis proxy kamu: http://, https://, atau socks5://
  return `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
}

const urls = (process.env.PROXY_URLS?.split(',').map(s => s.trim()).filter(Boolean)) || [];
if (!urls.length) urls.push(envProxyFromCreds());

const pool: ProxyEntry[] = urls.map(u => ({ url: u }));
let idx = 0;
const COOLDOWN_MS = 60_000;

export function getAgent(): Dispatcher {
  if (!PROXY_ENABLED) {
    // direct tanpa proxy
    return new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 120_000 });
  }
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[idx % pool.length];
    idx++;
    if (!candidate.badUntil || candidate.badUntil < now()) {
      return new ProxyAgent(candidate.url);
    }
  }
  const best = pool.reduce((a, b) => (a.badUntil! < b.badUntil! ? a : b));
  return new ProxyAgent(best.url);
}

export function markProxyBad(url?: string) {
  if (!url) return;
  const found = pool.find(p => p.url === url);
  if (found) found.badUntil = now() + COOLDOWN_MS;
}
