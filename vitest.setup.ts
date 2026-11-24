import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// next/font/google and next/font/local only work inside the Next compiler.
// Tests that import a module using them (the /notes room imports Jost) get a
// stand-in font object.
const { mockFont } = vi.hoisted(() => ({
  mockFont: (opts?: { variable?: string }) => ({
    className: 'font-mock',
    variable: opts?.variable ? `font-mock${opts.variable.replace(/^-+/, '-')}` : 'font-mock',
    style: { fontFamily: 'mock' },
  }),
}));
vi.mock('next/font/google', () => ({
  Cormorant_Garamond: mockFont,
  IBM_Plex_Mono: mockFont,
  Newsreader: mockFont,
}));
vi.mock('next/font/local', () => ({ default: mockFont }));
