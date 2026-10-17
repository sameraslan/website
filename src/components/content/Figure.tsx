import type { ReactNode } from 'react';

// A numbered figure for MDX bodies. Without `src` it renders a dashed
// placeholder box that says which figure goes there; pass `src` and `alt`
// once the image exists in public/. The image links to the file at full size. In MDX, pass number as a string
// (number="1"): next-mdx-remote strips {expression} attributes.
export function Figure({
  number,
  src,
  alt = '',
  placeholder,
  children,
}: {
  number: number | string;
  src?: string;
  alt?: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <figure className="my-8">
      {src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          title="open full size"
          className="block border-b-0 cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" className="w-full h-auto border border-rule-soft" />
        </a>
      ) : (
        <div
          data-figure-placeholder={number}
          className="flex aspect-[16/9] w-full items-center justify-center border border-dashed border-ink-dim bg-paper-soft px-6 text-center font-mono text-tiny uppercase text-ink-muted"
        >
          <span>
            placeholder · figure {number}
            {placeholder && (
              <span className="mt-2 block normal-case tracking-normal">{placeholder}</span>
            )}
          </span>
        </div>
      )}
      {(children || src) && (
        <figcaption className="mt-3 text-small leading-relaxed text-ink-muted [&>p+p]:mt-2">
          {children}
          {src && (
            <p className="font-mono text-tiny uppercase">
              <a href={src} target="_blank" rel="noreferrer">
                open figure {number} full size ↗
              </a>
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
