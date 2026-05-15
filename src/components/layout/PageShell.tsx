import clsx from 'clsx';
import { MobileExternalLinks } from './MobileNav';

type Width = 'full' | 'text' | 'list' | 'prose';

const widthClass: Record<Width, string> = {
  full: '',
  text: 'max-w-text',
  list: 'max-w-list',
  prose: 'max-w-prose',
};

export function PageShell({
  width = 'text',
  children,
}: {
  width?: Width;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={clsx('w-full', widthClass[width])}>{children}</div>
      <MobileExternalLinks />
    </>
  );
}
