import { PageShell } from '@/components/layout/PageShell';

export const metadata = { title: 'misc — samer aslan' };

export default function MiscPage() {
  return (
    <PageShell width="text">
      <h1 className="font-serif text-h1 mb-8">misc</h1>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">brain & cognition</h2>
        <p className="text-body text-ink-muted">
          Notes and links coming. Interested in perception, cross-modal binding, the neuroscience of music,
          and how the brain stitches sensory streams into a single experience.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">books</h2>
        <p className="text-body text-ink-muted">
          A running list of books I'd recommend, with a one-line note each. Coming soon.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h2 mb-4">nutrition</h2>
        <p className="text-body text-ink-muted">
          Notes on nutrition and well-being. Coming soon.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-h2 mb-4">links</h2>
        <p className="text-body text-ink-muted">
          Things I've come back to. Coming soon.
        </p>
      </section>
    </PageShell>
  );
}
