import clsx from 'clsx';

export function MusicMapCaption({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        'text-center text-small text-ink-muted italic mt-6',
        className
      )}
    >
      {text}
    </p>
  );
}
