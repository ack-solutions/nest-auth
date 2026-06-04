/**
 * Real tests for client/event-emitter.ts
 *
 * NO MOCKS. EventEmitter is pure data structures + functions.
 *
 * Covers: TC-500..TC-505 from .tasks/test-catalog.md §B.6
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, createAuthEventEmitter } from '../../src/client/event-emitter';

interface Events {
  ping: { msg: string };
  signal: void;
  numeric: number;
}

describe('EventEmitter — TC-500..TC-505', () => {
  describe('on / emit — TC-500, TC-503', () => {
    it('registers and fires a listener', () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      ee.on('ping', ({ msg }) => received.push(msg));
      ee.emit('ping', { msg: 'hello' });

      expect(received).toEqual(['hello']);
    });

    it('TC-503: fires all listeners in registration order', () => {
      const ee = new EventEmitter<Events>();
      const order: string[] = [];

      ee.on('ping', () => order.push('a'));
      ee.on('ping', () => order.push('b'));
      ee.on('ping', () => order.push('c'));

      ee.emit('ping', { msg: '' });
      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('does nothing when no listeners are registered', () => {
      const ee = new EventEmitter<Events>();
      expect(() => ee.emit('ping', { msg: 'noop' })).not.toThrow();
    });
  });

  describe('off — TC-501', () => {
    it('removes a specific listener via off()', () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];
      const listener = ({ msg }: { msg: string }) => received.push(msg);

      ee.on('ping', listener);
      ee.off('ping', listener);
      ee.emit('ping', { msg: 'should-not-fire' });

      expect(received).toEqual([]);
    });

    it('removes a listener via the unsubscribe function returned by on()', () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      const unsubscribe = ee.on('ping', ({ msg }) => received.push(msg));

      ee.emit('ping', { msg: 'first' });
      unsubscribe();
      ee.emit('ping', { msg: 'second' });

      expect(received).toEqual(['first']);
    });
  });

  describe('once — TC-502', () => {
    it('fires once, then removes itself', () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      ee.once('ping', ({ msg }) => received.push(msg));

      ee.emit('ping', { msg: 'first' });
      ee.emit('ping', { msg: 'second' });
      ee.emit('ping', { msg: 'third' });

      expect(received).toEqual(['first']);
    });

    it('returns an unsubscribe fn that prevents firing if called before emit', () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      const unsubscribe = ee.once('ping', ({ msg }) => received.push(msg));
      unsubscribe();

      ee.emit('ping', { msg: 'should-not-fire' });
      expect(received).toEqual([]);
    });
  });

  describe('emitAsync — TC-504', () => {
    it('awaits async listeners', async () => {
      const ee = new EventEmitter<Events>();
      const order: string[] = [];

      ee.on('ping', async () => {
        order.push('start-a');
        await new Promise((r) => setTimeout(r, 5));
        order.push('end-a');
      });
      ee.on('ping', async () => {
        order.push('start-b');
        await new Promise((r) => setTimeout(r, 5));
        order.push('end-b');
      });

      await ee.emitAsync('ping', { msg: 'async-test' });

      // All listeners run to completion before emitAsync resolves
      expect(order).toContain('end-a');
      expect(order).toContain('end-b');
      expect(order.length).toBe(4);
    });

    it('emitAsync returns immediately when no listeners', async () => {
      const ee = new EventEmitter<Events>();
      await ee.emitAsync('ping', { msg: '' });
      // No assertion needed — just verifying it doesn't hang
    });
  });

  describe('error isolation — TC-505', () => {
    it("a listener that throws does NOT stop other listeners (sync emit)", () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ee.on('ping', () => {
        throw new Error('listener-a broke');
      });
      ee.on('ping', ({ msg }) => received.push(msg));

      ee.emit('ping', { msg: 'still-runs' });

      expect(received).toEqual(['still-runs']);
      errorSpy.mockRestore();
    });

    it('a listener that throws does NOT stop other listeners (async emit)', async () => {
      const ee = new EventEmitter<Events>();
      const received: string[] = [];

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ee.on('ping', () => {
        throw new Error('boom');
      });
      ee.on('ping', async ({ msg }) => {
        await new Promise((r) => setTimeout(r, 1));
        received.push(msg);
      });

      await ee.emitAsync('ping', { msg: 'async-resilient' });

      expect(received).toEqual(['async-resilient']);
      errorSpy.mockRestore();
    });
  });

  describe('removeAllListeners', () => {
    it('clears listeners for a specific event', () => {
      const ee = new EventEmitter<Events>();
      let pings = 0;
      let signals = 0;

      ee.on('ping', () => pings++);
      ee.on('signal', () => signals++);

      ee.removeAllListeners('ping');

      ee.emit('ping', { msg: 'x' });
      ee.emit('signal', undefined);

      expect(pings).toBe(0);
      expect(signals).toBe(1);
    });

    it('clears all listeners when no event specified', () => {
      const ee = new EventEmitter<Events>();
      let pings = 0;
      let signals = 0;

      ee.on('ping', () => pings++);
      ee.on('signal', () => signals++);

      ee.removeAllListeners();

      ee.emit('ping', { msg: 'x' });
      ee.emit('signal', undefined);

      expect(pings).toBe(0);
      expect(signals).toBe(0);
    });
  });

  describe('createAuthEventEmitter', () => {
    it('returns a typed EventEmitter for AuthEvents', () => {
      const ee = createAuthEventEmitter();
      expect(ee).toBeInstanceOf(EventEmitter);

      // Spot-check: register a typed listener
      let captured: any;
      ee.on('tokensSet', (data) => (captured = data));
      ee.emit('tokensSet', { accessToken: 'a', refreshToken: 'r' });

      expect(captured).toEqual({ accessToken: 'a', refreshToken: 'r' });
    });
  });
});
