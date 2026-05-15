import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f6f0e1',
        'paper-soft': '#fbf6e6',
        ink: '#2d2a22',
        'ink-muted': '#6b6852',
        'ink-dim': '#b3ab94',
        sage: '#5b7855',
        'sage-deep': '#3e5a3a',
        rule: '#d8d0bd',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        tiny: ['0.75rem',   { lineHeight: '1.4' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        body: ['1.0625rem', { lineHeight: '1.6' }],
        h3: ['1.25rem',     { lineHeight: '1.4' }],
        h2: ['1.75rem',     { lineHeight: '1.3' }],
        h1: ['2.5rem',      { lineHeight: '1.2' }],
      },
      maxWidth: {
        prose: '680px',
        text: '640px',
        list: '800px',
      },
      transitionDuration: { DEFAULT: '180ms' },
    },
  },
  plugins: [],
};

export default config;
