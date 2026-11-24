import localFont from 'next/font/local';

// Letter board face for the /notes room. Kept out of src/lib/fonts.ts (which the
// root layout imports) so only the room's route links and preloads it. Applied
// on the room's own root rather than on <html>. Self-hosted (Jost variable,
// latin subset) because the build that fetched it from Google failed on Vercel.
export const jost = localFont({
  src: './fonts/jost-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-jost',
});
