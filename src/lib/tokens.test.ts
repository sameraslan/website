import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('design tokens in globals.css @theme block', () => {
  const css = readFileSync(
    path.resolve(__dirname, '../app/globals.css'),
    'utf-8'
  );

  it('contains the font tokens', () => {
    expect(css).toContain('--font-display:');
  });

  it('contains the text size tokens', () => {
    expect(css).toContain('--text-tiny:');
    expect(css).toContain('--text-h1:');
  });

  it('contains the container token for page width', () => {
    expect(css).toContain('--container-page: 1180px');
  });

  it('contains the default transition duration token', () => {
    expect(css).toContain('--default-transition-duration: 180ms');
  });
});
