import { Jost } from 'next/font/google';

// Letter board face for the /notes room. Kept out of src/lib/fonts.ts (which the
// root layout imports) so only the room's route links and preloads it. Applied
// on the room's own root rather than on <html>.
export const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-jost',
});
