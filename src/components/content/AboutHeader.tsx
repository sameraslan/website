import Image from 'next/image';

export function AboutHeader() {
  return (
    <div className="grid gap-10 sm:grid-cols-[1fr_220px] sm:gap-12 max-w-[880px]">
      <div
        className="font-serif text-[1.03rem] leading-[1.6]"
        style={{ textWrap: 'pretty' as never }}
      >
        <p className="m-0">
          <span
            className="font-display text-ochre"
            style={{
              fontSize: '3.75rem',
              lineHeight: 0.8,
              float: 'left',
              paddingRight: '0.55rem',
              paddingTop: '0.25rem',
            }}
          >
            I
          </span>
          blend AI/ML research with engineering, and care about shipping work
          that&apos;s useful to the people on the other end of it.
        </p>

        <p className="mt-4 m-0">Other things I think about a lot:</p>
        <ul className="mt-2 mb-0 pl-5 list-disc marker:text-ink-dim space-y-1">
          <li>human psychology and behavior</li>
          <li>the brain, and its role in sensation and perception</li>
          <li>art, especially music and how it shapes cognition</li>
          <li>nutrition, and how it ties into how you feel through a day</li>
        </ul>

        <p className="mt-4">
          I&apos;m always glad to hear from people working on or thinking about
          any of this. The email icon in the footer reaches me directly. I
          write back.
        </p>
      </div>

      <aside className="order-first sm:order-none">
        <Image
          src="/images/avatar.jpg"
          alt="Samer Aslan"
          width={220}
          height={260}
          className="w-full h-auto object-cover"
          priority
        />
        <p className="mt-2 font-mono text-tiny uppercase text-ink-muted">
          new york · 2026
        </p>
      </aside>
    </div>
  );
}
