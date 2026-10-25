import { AppError } from './errors';
export class RateLimiter {
  private calls: number[] = [];
  private blockedUntil = 0;
  constructor(
    private now: () => number = Date.now,
    private limit = 15,
    private windowMs = 60_000,
  ) {}
  acquire() {
    const now = this.now();
    this.calls = this.calls.filter((t) => now - t < this.windowMs);
    const wait = Math.max(
      this.blockedUntil - now,
      this.calls.length >= this.limit ? this.calls[0] + this.windowMs + 1 - now : 0,
    );
    if (wait > 0)
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Request limit reached. Wait before retrying.',
        Math.ceil(wait / 1000),
      );
    this.calls.push(now);
  }
  cooldown(seconds: number) {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + seconds * 1000);
  }
}
export function retryDelay(header: string | null, now = Date.now()): number {
  if (header === null) return 60;
  const n = Number(header);
  if (Number.isFinite(n)) return Math.max(1, Math.ceil(n));
  const time = Date.parse(header);
  return Number.isFinite(time) ? Math.max(1, Math.ceil((time - now) / 1000)) : 60;
}
