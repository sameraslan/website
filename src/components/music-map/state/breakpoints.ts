/**
 * Single source of truth for the mobile/desktop breakpoint used across the
 * music map's load path: MusicMapClient.tsx's module-scope prefetch guard,
 * MusicMap.tsx's isNarrow check, and SiteHeader.tsx's layout switch all need
 * the same 640px cutoff to agree, or a phone can end up fetching the desktop
 * payload from one of them while the others correctly skip it.
 */
export const NARROW_MEDIA_QUERY = "(max-width: 639px)";

/** Mirrors NARROW_MEDIA_QUERY as the inverse min-width query, for contexts
 * (like a <link media="..."> attribute in a server component) that can't
 * evaluate matchMedia and instead need the browser to gate on the query
 * itself. */
export const NOT_NARROW_MEDIA_QUERY = "(min-width: 640px)";
