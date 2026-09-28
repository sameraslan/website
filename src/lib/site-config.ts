export type NavItem = { label: string; href: string };

export const siteConfig = {
  name: 'samer aslan',
  meta: {
    title: 'samer aslan',
    description: 'samer aslan\'s personal website: ml work, research, a music map, and more',
  },
  nav: [
    { label: 'about',    href: '/about' },
    { label: 'projects', href: '/projects' },
    { label: 'research', href: '/research' },
    { label: 'music',    href: '/music' },
    { label: 'art',      href: '/art' },
  ] as NavItem[],
  external: [
    { label: 'email',    href: 'mailto:samer.aslan@gmail.com' },
    { label: 'github',   href: 'https://github.com/sameraslan' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/sameraslan/' },
  ] as NavItem[],
  facts: {
    now: 'ML at Bloomberg Law',
    before: 'Johns Hopkins, CLSP and Dynamic Perception Lab',
    where: 'Brooklyn, New York',
  },
};

export type SiteConfig = typeof siteConfig;
