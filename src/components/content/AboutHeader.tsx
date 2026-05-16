import Image from 'next/image';
import Link from 'next/link';

export function AboutHeader() {
  return (
    <div className="grid gap-10 sm:grid-cols-[1fr_220px] sm:gap-12 max-w-[880px]">
      <div
        className="font-serif text-[1.03rem] leading-[1.6] [column-gap:3rem] sm:[column-count:2]"
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
            S
          </span>
          oftware engineer at Bloomberg, based in New York. Studied computer
          science, computer engineering, and cognitive science at Johns Hopkins.
          I speak English, Türkçe, and Español, passably.
        </p>
        <p className="mt-3.5">
          I build things that sit between engineering and the humanities:
          perception, music cognition, language, the small ways behavior changes
          when interfaces change. AI/ML research with the engineering required
          to make it actually run on something.
        </p>
        <p className="mt-3.5">
          Outside of work: psychology, perception, music cognition (obviously),
          art, and food as it relates to how you actually feel during a day. I
          keep a quiet field journal of all of the above.
        </p>
        <p className="mt-3.5">
          If any of this overlaps with what you’re thinking about (research, a
          project, an idea you can’t shake),{' '}
          <Link
            href="mailto:samer.aslan.second@gmail.com"
            className="text-moss border-b border-rule-soft hover:border-moss"
          >
            write me
          </Link>
          . I write back.
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
