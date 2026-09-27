export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-page px-6 sm:px-10 md:px-16 py-10">
      {children}
    </div>
  );
}
