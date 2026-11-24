'use client';

import { usePathname } from 'next/navigation';

// Paths that render full-bleed with no site header or footer.
export const CHROMELESS_PATHS = ['/notes'];

export function isChromeless(pathname: string | null): boolean {
  return pathname !== null && CHROMELESS_PATHS.includes(pathname);
}

// Renders its children everywhere except on the chromeless paths.
export function ChromeGate({ children }: { children: React.ReactNode }) {
  return isChromeless(usePathname()) ? null : <>{children}</>;
}
