import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'now — samer aslan' };

const LAST_UPDATED = '2026-05-15';

export default function NowPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-2">now</h1>
      <p className="font-mono text-tiny text-ink-dim mb-10">a /now page · what I&apos;m focused on these days</p>

      <div className="space-y-6 text-body">
        <p>
          Working at Bloomberg as a software engineer. Most of my day is in the equities space — the projects
          I can talk about publicly will end up on <Link href="/projects" className="text-sage hover:text-sage-deep">projects</Link>.
        </p>
        <p>
          Reading more about how perception works in the brain — particularly around audio and cross-modal
          binding. The music map on this site is the visible end of that interest.
        </p>
        <p>
          Listening to a lot of jazz lately and slowly making the listening map richer.
        </p>
      </div>

      <p className="mt-12 font-mono text-tiny text-ink-dim">last updated {LAST_UPDATED}</p>
    </PageShell>
  );
}
