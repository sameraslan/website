import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// next/font/google only works inside the Next compiler. Tests that import a
// module using it (the /notes room imports Jost) get a stand-in font object.
vi.mock('next/font/google', () => {
  const font = (opts?: { variable?: string }) => ({
    className: 'font-mock',
    variable: opts?.variable ? `font-mock${opts.variable.replace(/^-+/, '-')}` : 'font-mock',
    style: { fontFamily: 'mock' },
  });
  return { Cormorant_Garamond: font, IBM_Plex_Mono: font, Jost: font, Newsreader: font };
});
