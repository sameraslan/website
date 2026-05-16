import clsx from 'clsx';

export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={clsx(
        'font-display font-normal text-h1 sm:text-[2.75rem] leading-none -tracking-[0.02em] pb-4 mb-8 border-b border-rule',
        className
      )}
    >
      {children}
    </h1>
  );
}
