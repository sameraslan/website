import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

// Links in entry bodies behave like the ones in EntryDetailHeader: site paths
// navigate client-side, everything else opens in a new tab.
function MdxLink({ href = '', ...rest }: ComponentPropsWithoutRef<'a'>) {
  if (href.startsWith('/') || href.startsWith('#')) {
    return <Link href={href} {...rest} />;
  }
  return <a href={href} target="_blank" rel="noreferrer" {...rest} />;
}

export const mdxComponents = { a: MdxLink };
