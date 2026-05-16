import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="flex flex-col justify-center min-h-[60vh]">
      <h1 className="font-display font-normal leading-[0.9] -tracking-[0.035em] text-[3.5rem] sm:text-[6.5rem] m-0">
        no page <span className="italic text-moss">at that path.</span>
      </h1>
      <p className="font-serif text-[1.25rem] text-ink-muted mt-4 mb-6 max-w-[36ch]">
        either i moved it, or you typed it.
      </p>
      <Link
        href="/"
        className="font-serif italic text-[1.15rem] text-moss border-b border-moss pb-0.5 self-start"
      >
        ← go home
      </Link>
    </section>
  );
}
