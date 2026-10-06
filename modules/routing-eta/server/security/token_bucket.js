// In-memory token bucket rate limiting. No timers: refill is computed lazily
// from the clock on every take(), so an idle limiter costs nothing.

export class TokenBucket {
  /**
   * @param {{capacity:number, refillPerSec:number, now?:()=>number}} o
   *   capacity     = burst size (tokens available when idle)
   *   refillPerSec = sustained rate
   */
  constructor({ capacity, refillPerSec, now = Date.now }) {
    if (!(capacity >= 1) || !(refillPerSec > 0)) {
      throw new Error('TokenBucket needs capacity >= 1 and refillPerSec > 0');
    }
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this._now = now;
    this.tokens = capacity;
    this.updatedAt = now();
  }

  _refill() {
    const t = this._now();
    const elapsed = Math.max(0, t - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.updatedAt = t;
  }

  /** @returns {boolean} true when the call is allowed (a token was spent). */
  take(n = 1) {
    this._refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** Seconds until n tokens are available (0 when available now). */
  retryAfterSec(n = 1) {
    this._refill();
    if (this.tokens >= n) return 0;
    return Math.ceil((n - this.tokens) / this.refillPerSec);
  }

  /** true when the bucket is full again, i.e. the key can be forgotten. */
  isIdle() {
    this._refill();
    return this.tokens >= this.capacity;
  }
}

/** One bucket per key (uid, ip, ...) with bounded memory. */
export class KeyedLimiter {
  constructor({ capacity, refillPerSec, now = Date.now, maxKeys = 50000 }) {
    this._opts = { capacity, refillPerSec, now };
    this._now = now;
    this._maxKeys = maxKeys;
    this._buckets = new Map();
    this._ops = 0;
  }

  _bucket(key) {
    let b = this._buckets.get(key);
    if (!b) {
      this._sweepIfNeeded();
      b = new TokenBucket(this._opts);
      this._buckets.set(key, b);
    }
    return b;
  }

  take(key, n = 1) {
    this._ops += 1;
    return this._bucket(String(key)).take(n);
  }

  retryAfterSec(key, n = 1) {
    return this._bucket(String(key)).retryAfterSec(n);
  }

  get size() {
    return this._buckets.size;
  }

  /** Drop buckets that have fully refilled (no information lost). */
  sweep() {
    for (const [k, b] of this._buckets) {
      if (b.isIdle()) this._buckets.delete(k);
    }
  }

  _sweepIfNeeded() {
    if (this._buckets.size < this._maxKeys) return;
    this.sweep();
    // Still full of active offenders: evict the oldest key rather than grow
    // without bound (an attacker rotating keys cannot exhaust memory).
    if (this._buckets.size >= this._maxKeys) {
      const oldest = this._buckets.keys().next().value;
      this._buckets.delete(oldest);
    }
  }
}
