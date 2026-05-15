import './globals.css';
import { fraunces, jetbrainsMono } from '@/lib/fonts';

export const metadata = {
  title: 'samer aslan',
  description: 'personal site of samer aslan — engineer, researcher, listener.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
