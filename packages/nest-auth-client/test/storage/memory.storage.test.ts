/**
 * Real tests for storage/memory.storage.ts
 *
 * NO MOCKS. MemoryStorage is just a Map<string, string> wrapper.
 *
 * Covers: TC-440 from .tasks/test-catalog.md §B.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../src/storage/memory.storage';

describe('MemoryStorage — TC-440', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('get returns null for unknown key', () => {
    expect(storage.get('nonexistent')).toBeNull();
  });

  it('set + get round-trip', () => {
    storage.set('key', 'value');
    expect(storage.get('key')).toBe('value');
  });

  it('set overwrites existing value', () => {
    storage.set('key', 'first');
    storage.set('key', 'second');
    expect(storage.get('key')).toBe('second');
  });

  it('remove deletes the key', () => {
    storage.set('key', 'value');
    storage.remove('key');
    expect(storage.get('key')).toBeNull();
  });

  it('remove on nonexistent key is a no-op (no throw)', () => {
    expect(() => storage.remove('nonexistent')).not.toThrow();
  });

  it('clear removes all keys', () => {
    storage.set('a', '1');
    storage.set('b', '2');
    storage.set('c', '3');
    storage.clear();
    expect(storage.get('a')).toBeNull();
    expect(storage.get('b')).toBeNull();
    expect(storage.get('c')).toBeNull();
  });

  it('empty-string value is stored and retrieved (not coerced to null)', () => {
    storage.set('key', '');
    expect(storage.get('key')).toBe('');
  });

  it('two MemoryStorage instances do NOT share state', () => {
    const a = new MemoryStorage();
    const b = new MemoryStorage();
    a.set('x', 'in-a');
    expect(b.get('x')).toBeNull();
  });
});
