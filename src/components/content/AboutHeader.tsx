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
          &apos;m passionate about blending cutting-edge AI and machine learning
          research with engineering to develop innovative solutions that create
          meaningful and positive experiences for people.
        </p>

        <p className="mt-4 m-0">My non-tech interests include:</p>
        <ul className="mt-2 mb-0 pl-5 list-disc marker:text-ink-dim space-y-1">
          <li>Human psychology and behavior</li>
          <li>The brain and its role in sensation and perception</li>
          <li>Art, especially music and its influence on cognition</li>
          <li>The intersection of nutrition and human well-being</li>
        </ul>

        <p className="mt-4">
          I&apos;m especially excited about how these fields can intersect with
          technology to enhance the human experience. I&apos;m always open to
          speaking with others who share similar interests or are working on
          related projects—feel free to reach out!
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
