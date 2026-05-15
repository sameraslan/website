import './globals.css';

export const metadata = { title: 'samer aslan', description: 'personal site' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
