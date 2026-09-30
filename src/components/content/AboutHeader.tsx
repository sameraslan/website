import Image from 'next/image';
import Link from 'next/link';

import { siteConfig } from '@/lib/site-config';

import { AboutFacts } from './AboutFacts';

export function AboutHeader() {
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_260px] sm:gap-16">
      <div className="order-2 sm:order-1">
        <div
          className="font-serif text-[1.03rem] leading-[1.6] max-w-text"
          style={{ textWrap: 'pretty' as never }}
        >
          <p className="m-0">
            Hey, I&apos;m Samer. I&apos;m a machine learning engineer at
            Bloomberg and the technical lead on BLaw AI, Bloomberg Law&apos;s AI
            agent. It&apos;s basically Claude Code for lawyers: an agent that
            takes an attorney through a legal matter from start to finish.
            Before Bloomberg, I studied computer science, cognitive science,
            and computer engineering at Johns Hopkins.
          </p>

          <p className="mt-4 m-0">
            I&apos;m mostly interested in where neuroscience and AI overlap,
            especially how ideas from the brain can make AI systems more
            robust. In law, I{' '}
            <a
              href="https://arxiv.org/abs/2605.16052"
              target="_blank"
              rel="noreferrer"
              className="text-moss hover:text-moss-deep transition-colors"
            >
              pair LLMs with deterministic, logic-based methods
            </a>{' '}
            to reduce hallucinations and make their reasoning more consistent.
          </p>

          <p className="mt-4 m-0">
            I&apos;m also a visiting researcher at the Visual Inference Lab at
            Columbia, where I work on{' '}
            <Link href="/research/unimap" className="text-moss hover:text-moss-deep transition-colors">
              UniMap
            </Link>
            , a new, more intuitive way to visualize complex high-dimensional
            data. The rough idea is a cross between a word cloud and PCA.
          </p>

          <p className="mt-4 m-0">
            Outside of work, I like exploring art and seeing how far I can
            stretch my taste, in music, film, visual art, and books.
            Music-wise, I&apos;m into krautrock, post-punk, jazz-rock, and
            really everything else. I&apos;ve always gravitated toward
            percussion when I listen, so I&apos;ve been learning the drums as
            well. Same goes for coffee: I like anaerobic and natural processed
            beans that make you rethink coffee entirely.
          </p>

          <p className="mt-4">
            If any of this interests you as well, or overlaps with what
            you&apos;re working on, I&apos;d love to chat. You can{' '}
            <a
              href="https://calendly.com/samer-aslan/30min"
              target="_blank"
              rel="noreferrer"
              className="text-moss hover:text-moss-deep transition-colors"
            >
              grab a time here
            </a>{' '}
            or just{' '}
            <a
              href="mailto:samer.aslan@gmail.com"
              className="text-moss hover:text-moss-deep transition-colors"
            >
              email me
            </a>
            .
          </p>
        </div>

        <div className="mt-6 flex items-center gap-[22px] font-serif text-[1rem] italic">
          {siteConfig.external.map((item) => {
            const external = item.href.startsWith('http');
            return (
              <a
                key={item.href}
                href={item.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                className="text-moss hover:text-moss-deep transition-colors"
              >
                {item.label} {external ? '↗' : '→'}
              </a>
            );
          })}
        </div>
      </div>

      <aside className="order-1 sm:order-2 sm:pt-[14px]">
        <Image
          src="/images/avatar.jpg"
          alt="Samer Aslan"
          width={220}
          height={220}
          className="w-[160px] sm:w-[220px] mx-auto sm:mx-0 aspect-square rounded-full object-cover"
          style={{
            WebkitMaskImage:
              'radial-gradient(circle, black 62%, transparent 92%)',
            maskImage: 'radial-gradient(circle, black 62%, transparent 92%)',
          }}
          priority
        />
        <div className="mt-4">
          <AboutFacts />
        </div>
      </aside>
    </div>
  );
}
