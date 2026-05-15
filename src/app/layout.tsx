import './globals.css';
import { fraunces, jetbrainsMono } from '@/lib/fonts';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { siteConfig } from '@/lib/site-config';

export const metadata = {
  title: siteConfig.meta.title,
  description: siteConfig.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <div className="min-h-screen px-8 md:px-16 pt-14 pb-8 md:flex md:gap-20">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <MobileNav />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
