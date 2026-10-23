import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../src/index';
import { randomValue, parseNumber } from '../../src/functions/values';
import { parseTime } from '../../src/functions/live';
import * as scheduler from '../../src/core/scheduler';

describe('random()', () => {
  it('interpolates same-unit ranges', () => {
    expect(randomValue('100px', '300px', undefined, 0)).toBe('100px');
    expect(randomValue('100px', '300px', undefined, 0.5)).toBe('200px');
    expect(randomValue('0.3', '1', undefined, 0.5)).toBe('0.65');
    expect(randomValue('-20deg', '20deg', undefined, 0.25)).toBe('-10deg');
    expect(randomValue('0', '10px', undefined, 0.5)).toBe('5px');
  });
  it('steps with "by" and can reach max', () => {
    expect(randomValue('0px', '10px', '5px', 0)).toBe('0px');
    expect(randomValue('0px', '10px', '5px', 0.5)).toBe('5px');
    expect(randomValue('0px', '10px', '5px', 0.99)).toBe('10px');
    expect(() => randomValue('0px', '10px', '0px', 0.5)).toThrow(/greater than 0/);
  });
  it('clamps to min when max < min', () => {
    expect(randomValue('10px', '5px', undefined, 0.9)).toBe('10px');
  });
  it('delegates mixed units and var() to calc()', () => {
    expect(randomValue('1em', '10px', undefined, 0.5)).toBe('calc(1em + (10px - 1em) * 0.5)');
    expect(randomValue('0px', 'var(--w)', undefined, 0.25)).toBe('calc(0px + (var(--w) - 0px) * 0.25)');
    expect(() => randomValue('1em', '10px', '1px', 0.5)).toThrow();
  });
  it('parses numbers', () => {
    expect(parseNumber('.5E2PX')).toEqual({ v: 50, unit: 'px' });
    expect(parseNumber('calc(1px)')).toBeUndefined();
  });
});

describe('live() intervals', () => {
  it('parses ms and s', () => {
    expect(parseTime('200ms')).toBe(200);
    expect(parseTime('1.5s')).toBe(1500);
    expect(parseTime('2')).toBeUndefined();
  });
});

describe('scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const sub = () => ({ tick: vi.fn() });

  it('groups subscriptions by interval with one timer and supports cancellation', () => {
    const a = sub(), b = sub(), c = sub();
    scheduler.every(100, a);
    scheduler.every(100, b);
    scheduler.every(250, c);
    expect(scheduler.groupCount()).toBe(2);
    expect(scheduler.subscriptionCount()).toBe(3);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(a.tick).toHaveBeenCalledTimes(5);
    expect(b.tick).toHaveBeenCalledTimes(5);
    expect(c.tick).toHaveBeenCalledTimes(2);
    scheduler.unevery(100, a);
    vi.advanceTimersByTime(100);
    expect(a.tick).toHaveBeenCalledTimes(5);
    expect(b.tick).toHaveBeenCalledTimes(6);
    scheduler.unevery(100, b); scheduler.unevery(250, c);
    expect(scheduler.groupCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips missed ticks instead of bursting after a long delay', () => {
    const a = sub();
    scheduler.every(100, a);
    const now = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(now + 10_000);
    vi.advanceTimersByTime(100);
    expect(a.tick).toHaveBeenCalledTimes(1);
    scheduler.unevery(100, a);
  });

  it('batches jobs: each queued once, all reads before all writes, unchanged values not written', () => {
    const log: string[] = [];
    const job = (n: string, changed: boolean) => ({
      compute: () => { log.push('read ' + n); return changed; },
      write: () => log.push('write ' + n),
    });
    const j1 = job('1', true), j2 = job('2', false), j3 = job('3', true);
    scheduler.dirty(j1); scheduler.dirty(j2); scheduler.dirty(j1); scheduler.dirty(j3);
    vi.advanceTimersByTime(16);
    expect(log).toEqual(['read 1', 'read 2', 'read 3', 'write 1', 'write 3']);
  });
});
