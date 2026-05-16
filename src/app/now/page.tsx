import { PageTitle } from '@/components/content/PageTitle';

export const metadata = { title: 'now — samer aslan' };

export default function NowPage() {
  return (
    <section>
      <PageTitle>now</PageTitle>
      <p className="font-serif italic text-[1.25rem] leading-snug text-ink-muted max-w-[46ch]">
        i’ll slowly add things here. what i’m working on, reading, listening
        to. nothing yet.
      </p>
    </section>
  );
}
