type Entry = {
  failuresAt: number[];
};

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, Entry>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number
  ) {}

  private prune(entry: Entry, now: number) {
    const cutoff = now - this.windowMs;
    entry.failuresAt = entry.failuresAt.filter(t => t > cutoff);
  }

  recordFailure(key: string) {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry) {
      entry = { failuresAt: [] };
      this.store.set(key, entry);
    }
    this.prune(entry, now);
    entry.failuresAt.push(now);
  }

  isLimited(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return false;
    this.prune(entry, now);
    return entry.failuresAt.length >= this.maxFailures;
  }

  /** Test-only reset */
  clear() {
    this.store.clear();
  }
}
