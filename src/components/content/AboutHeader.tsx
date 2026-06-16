import Image from 'next/image';

export function AboutHeader() {
  return (
    <div className="grid gap-10 sm:grid-cols-[1fr_220px] sm:gap-12 max-w-[880px]">
      <div
        className="font-serif text-[1.03rem] leading-[1.6]"
        style={{ textWrap: 'pretty' as never }}
      >
        <p className="m-0">
          I&apos;m passionate about using knowledge about the human brain to
          build models that blend machine learning with engineering to develop
          innovative solutions that create meaningful and positive experiences
          for people. These days, I work at the intersection of AI and law.
        </p>

        <p className="mt-4 m-0">My non-tech interests include:</p>
        <ul className="mt-2 mb-0 pl-5 list-disc marker:text-ink-dim space-y-1">
          <li>Human psychology, behaviour, and consciousness</li>
          <li>The brain and its role in sensation and perception</li>
          <li>Art, especially music and its influence on cognition</li>
          <li>The intersection of nutrition and human well-being</li>
        </ul>

        <p className="mt-4">
          I&apos;m especially excited about how these fields can intersect with
          machine learning to enhance the human experience, and am always open
          to speaking with others who share similar interests or are working on
          related projects. Feel free to reach out!
        </p>
      </div>

      <aside className="order-first sm:order-none">
        <Image
          src="/images/avatar.jpg"
          alt="Samer Aslan"
          width={220}
          height={220}
          className="w-full aspect-square rounded-full object-cover"
          style={{
            WebkitMaskImage:
              'radial-gradient(circle, black 62%, transparent 92%)',
            maskImage: 'radial-gradient(circle, black 62%, transparent 92%)',
          }}
          priority
        />
        <p className="mt-2 font-mono text-tiny uppercase text-ink-muted">
          Brooklyn, New York
        </p>
      </aside>
    </div>
  );
}
