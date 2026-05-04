import { LOGIN_RATE_LIMIT_MAX_FAILURES, LOGIN_RATE_LIMIT_WINDOW_MS } from "./constants";

type Entry = {
  failuresAt: number[];
};

const store = new Map<string, Entry>();

function prune(entry: Entry, now: number) {
  const cutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
  entry.failuresAt = entry.failuresAt.filter(t => t > cutoff);
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry) {
    entry = { failuresAt: [] };
    store.set(ip, entry);
  }
  prune(entry, now);
  entry.failuresAt.push(now);
}

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry) return false;
  prune(entry, now);
  return entry.failuresAt.length >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}
