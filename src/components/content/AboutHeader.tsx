import Image from 'next/image';

export function AboutHeader() {
  return (
    <div className="flex flex-col sm:flex-row gap-8 mb-10">
      <div className="shrink-0">
        <Image
          src="/images/avatar.jpg"
          alt="Samer Aslan"
          width={280}
          height={280}
          className="rounded-sm"
          priority
        />
      </div>
      <div className="space-y-4 text-body">
        <p>
          Samer Aslan — software engineer at Bloomberg, alum of Johns Hopkins (CS, Computer Engineering,
          Cognitive Science). Based in New York.
        </p>
        <p className="text-ink-muted">
          Speaks English, Turkish, Spanish.
        </p>
      </div>
    </div>
  );
}
