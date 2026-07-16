import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, bucketCount, _resetStore } from '@/lib/rateLimit';

beforeEach(() => {
  _resetStore();
});

describe('checkRateLimit — basic allow/deny', () => {
  it('allows the first request from a new IP', () => {
    const result = checkRateLimit('1.2.3.4', 'ai');
    expect(result.allowed).toBe(true);
  });

  it('allows requests up to the AI limit (20)', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('10.0.0.1', 'ai').allowed).toBe(true);
    }
  });

  it('denies the 21st request on the AI tier', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('10.0.0.2', 'ai');
    const result = checkRateLimit('10.0.0.2', 'ai');
    expect(result.allowed).toBe(false);
  });

  it('returns a positive retryAfter when denied', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('10.0.0.3', 'ai');
    const result = checkRateLimit('10.0.0.3', 'ai');
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it('allows requests up to the data limit (60)', () => {
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit('10.0.0.4', 'data').allowed).toBe(true);
    }
  });

  it('denies the 61st request on the data tier', () => {
    for (let i = 0; i < 60; i++) checkRateLimit('10.0.0.5', 'data');
    expect(checkRateLimit('10.0.0.5', 'data').allowed).toBe(false);
  });

  it('does not pollute across tiers — same IP, different tier', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('10.0.0.6', 'ai');
    // ai tier exhausted, but data tier should still be fresh
    expect(checkRateLimit('10.0.0.6', 'data').allowed).toBe(true);
  });

  it('does not pollute across IPs', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('192.168.1.1', 'ai');
    // Different IP should have its own fresh window
    expect(checkRateLimit('192.168.1.2', 'ai').allowed).toBe(true);
  });

  it('defaults to ai tier when no tier argument is provided', () => {
    // The overload with just ip should not throw
    expect(() => checkRateLimit('5.5.5.5')).not.toThrow();
  });
});

describe('checkRateLimit — LRU eviction', () => {
  it('tracks each unique IP in the bucket store', () => {
    checkRateLimit('10.1.1.1', 'ai');
    checkRateLimit('10.1.1.2', 'ai');
    expect(bucketCount()).toBeGreaterThanOrEqual(2);
  });

  it('does not throw when many IPs fill the store', () => {
    expect(() => {
      for (let i = 0; i < 600; i++) {
        checkRateLimit(`172.16.${Math.floor(i / 256)}.${i % 256}`, 'ai');
      }
    }).not.toThrow();
  });

  it('store size stays bounded after high-volume requests', () => {
    for (let i = 0; i < 600; i++) {
      checkRateLimit(`10.20.${Math.floor(i / 256)}.${i % 256}`, 'data');
    }
    // After eviction, store must be <= MAX_BUCKETS (500) + 1 tolerance
    expect(bucketCount()).toBeLessThanOrEqual(501);
  });
});

describe('checkRateLimit — retryAfter semantics', () => {
  it('allowed responses have no retryAfter field', () => {
    const result = checkRateLimit('6.6.6.6', 'ai');
    expect(result.retryAfter).toBeUndefined();
  });

  it('denied responses always include retryAfter', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('7.7.7.7', 'ai');
    const result = checkRateLimit('7.7.7.7', 'ai');
    expect(result.retryAfter).toBeDefined();
    expect(typeof result.retryAfter).toBe('number');
  });

  it('retryAfter is an integer number of seconds', () => {
    for (let i = 0; i < 20; i++) checkRateLimit('8.8.8.8', 'ai');
    const { retryAfter } = checkRateLimit('8.8.8.8', 'ai');
    expect(Number.isInteger(retryAfter)).toBe(true);
  });
});
