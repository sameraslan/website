import './globals.css';
import { newsreader, cormorant, ibmPlexMono } from '@/lib/fonts';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { siteConfig } from '@/lib/site-config';

export const metadata = {
  title: siteConfig.meta.title,
  description: siteConfig.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${cormorant.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-paper text-ink antialiased min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <div className="mx-auto max-w-page px-6 sm:px-10 md:px-16 py-10">
            {children}
          </div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
