import { describe, it, expect } from 'vitest';
import { isChromeless } from './ChromeGate';

describe('isChromeless', () => {
  it('is true for exactly /notes', () => {
    expect(isChromeless('/notes')).toBe(true);
  });

  it('is false everywhere else, the note pages included', () => {
    for (const path of ['/', '/notes/anything', '/notes/', null]) expect(isChromeless(path)).toBe(false);
  });
});
