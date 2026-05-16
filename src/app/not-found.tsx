import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';

export default function NotFound() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 text-sage mb-4">not found</h1>
      <p className="text-ink-muted">
        no page at that path. <Link href="/" className="text-sage hover:text-sage-deep">go home</Link>.
      </p>
    </PageShell>
  );
}
