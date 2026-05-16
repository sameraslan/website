export type NavItem = { label: string; href: string };

export const siteConfig = {
  name: 'samer aslan',
  tagline:
    'a map of how my listening sounds. points sit by sonic similarity, not by genre tag. it’s also the first thing on the site because it’s the easiest way in.',
  meta: {
    title: 'samer aslan',
    description: 'personal site of samer aslan — engineer, researcher, listener.',
  },
  nav: [
    { label: 'about',    href: '/about' },
    { label: 'projects', href: '/projects' },
    { label: 'research', href: '/research' },
    { label: 'music',    href: '/music' },
    { label: 'art',      href: '/art' },
    { label: 'now',      href: '/now' },
  ] as NavItem[],
  external: [
    { label: 'email',    href: 'mailto:samer.aslan.second@gmail.com' },
    { label: 'github',   href: 'https://github.com/sameraslan' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/sameraslan/' },
  ] as NavItem[],
};

export type SiteConfig = typeof siteConfig;
