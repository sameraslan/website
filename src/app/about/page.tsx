import { AboutHeader } from '@/components/content/AboutHeader';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'about — samer aslan' };

export default function AboutPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 text-sage mb-8">about</h1>
      <AboutHeader />
      <div className="space-y-6 text-body">
        <p>
          I&apos;m passionate about blending cutting-edge AI and machine learning research with engineering to
          develop innovative solutions that create meaningful and positive experiences for people.
        </p>
        <p>
          My non-tech interests include human psychology and behavior, the brain and its role in sensation
          and perception, art (especially music and its influence on cognition), and the intersection of
          nutrition and human well-being.
        </p>
        <p>
          I&apos;m always open to speaking with others who share similar interests or are working on related
          projects — feel free to reach out.
        </p>
      </div>
    </PageShell>
  );
}
