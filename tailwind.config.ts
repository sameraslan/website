import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf6ec',
        'paper-soft': '#fdfaf2',
        ink: '#231d14',
        'ink-muted': '#6b5e47',
        'ink-dim': '#a99c80',
        moss: '#5a7041',
        'moss-deep': '#3f5036',
        ochre: '#b8852e',
        'ochre-soft': '#c89844',
        rule: 'rgba(35,29,20,0.16)',
        'rule-soft': 'rgba(35,29,20,0.09)',
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'EB Garamond', 'Georgia', 'serif'],
        serif: ['var(--font-newsreader)', 'EB Garamond', 'Georgia', 'serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        tiny: ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.12em' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        body: ['1.03rem',  { lineHeight: '1.6' }],
        h3: ['1.5rem',     { lineHeight: '1.3' }],
        h2: ['2.25rem',    { lineHeight: '1.1' }],
        h1: ['2.75rem',    { lineHeight: '1.05' }],
        display: ['4.75rem', { lineHeight: '0.92' }],
      },
      maxWidth: {
        prose: '720px',
        text: '60ch',
        list: '880px',
        page: '1180px',
      },
      transitionDuration: { DEFAULT: '180ms' },
    },
  },
  plugins: [],
};

export default config;
