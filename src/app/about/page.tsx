import { AboutHeader } from '@/components/content/AboutHeader';
import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'about — samer aslan' };

export default function AboutPage() {
  return (
    <section>
      <PageTitle>about</PageTitle>
      <AboutHeader />
    </section>
  );
}
