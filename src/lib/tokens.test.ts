import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(
  path.resolve(__dirname, '../app/globals.css'),
  'utf-8'
);

/**
 * Pulls out the contents of the first `@theme { ... }` block and parses it
 * into a name -> value map. Declarations are `--name: value;` and several
 * can share one source line (e.g. the `--text-tiny` line also carries its
 * `--line-height` and `--letter-spacing` companions), so this scans for
 * `--token-name: value;` pairs anywhere in the block rather than splitting
 * by line.
 */
function parseThemeBlock(source: string): Record<string, string> {
  const blockMatch = source.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!blockMatch) {
    throw new Error('No @theme block found in globals.css');
  }
  const body = blockMatch[1];

  const tokens: Record<string, string> = {};
  const declRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(body)) !== null) {
    const [, name, rawValue] = match;
    tokens[name] = rawValue.trim();
  }
  return tokens;
}

describe('design tokens in globals.css @theme block', () => {
  const tokens = parseThemeBlock(css);

  // Table of expected name -> exact value, taken verbatim from spec section
  // 4.1. Each entry pins down not just presence but the exact declared
  // value, so a typo like `2.75re` instead of `2.75rem` fails the test.
  const expected: Record<string, string> = {
    '--font-display': "var(--font-cormorant), 'EB Garamond', Georgia, serif",
    '--font-serif': "var(--font-newsreader), 'EB Garamond', Georgia, serif",
    '--font-mono':
      'var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace',

    '--text-tiny': '0.625rem',
    '--text-tiny--line-height': '1.4',
    '--text-tiny--letter-spacing': '0.12em',

    '--text-small': '0.875rem',
    '--text-small--line-height': '1.5',

    '--text-body': '1.03rem',
    '--text-body--line-height': '1.6',

    '--text-h3': '1.5rem',
    '--text-h3--line-height': '1.3',

    '--text-h2': '2.25rem',
    '--text-h2--line-height': '1.1',

    '--text-h1': '2.75rem',
    '--text-h1--line-height': '1.05',

    '--text-display': '4.75rem',
    '--text-display--line-height': '0.92',

    '--container-prose': '720px',
    '--container-text': '60ch',
    '--container-list': '880px',
    '--container-page': '1180px',

    '--default-transition-duration': '180ms',
  };

  it.each(Object.entries(expected))(
    'declares %s as %s',
    (name, value) => {
      expect(tokens).toHaveProperty(name);
      expect(tokens[name]).toBe(value);
    }
  );

  it('declares every expected token (no missing keys)', () => {
    const missing = Object.keys(expected).filter((name) => !(name in tokens));
    expect(missing).toEqual([]);
  });
});
