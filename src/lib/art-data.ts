export interface ArtItem {
  title: string;
  secondary: string;
  year?: number;
  image?: string;
  note?: string;
}

export const ALBUMS: ArtItem[] = [
  { title: 'Future Days',                            secondary: 'Can',                 year: 1973, image: '/images/art/albums/future-days.jpg' },
  { title: 'Long Season',                            secondary: 'Fishmans',            year: 1996, image: '/images/art/albums/long-season.jpg' },
  { title: 'The Black Saint and the Sinner Lady',    secondary: 'Charles Mingus',      year: 1963, image: '/images/art/albums/black-saint-and-the-sinner-lady.jpg' },
  { title: 'Madvillainy',                            secondary: 'Madvillain',          year: 2004, image: '/images/art/albums/madvillainy.jpg' },
  { title: 'Loveless',                               secondary: 'My Bloody Valentine', year: 1991, image: '/images/art/albums/loveless.jpg' },
  { title: 'Minimal Nation',                         secondary: 'Robert Hood',         year: 1994, image: '/images/art/albums/minimal-nation.jpg' },
  { title: 'Lanquidity',                             secondary: 'Sun Ra',              year: 1978, image: '/images/art/albums/lanquidity.jpg' },
];

export const FILMS: ArtItem[] = [
  { title: '12 Angry Men',          secondary: 'Sidney Lumet',         year: 1957, image: '/images/art/films/12-angry-men.jpg' },
  { title: 'The Battle of Algiers', secondary: 'Gillo Pontecorvo',     year: 1966, image: '/images/art/films/battle-of-algiers.jpg' },
  { title: 'Seven Samurai',         secondary: 'Akira Kurosawa',       year: 1954, image: '/images/art/films/seven-samurai.jpg' },
  { title: 'Harakiri',              secondary: 'Masaki Kobayashi',     year: 1962, image: '/images/art/films/harakiri.jpg' },
  { title: 'Mulholland Dr.',        secondary: 'David Lynch',          year: 2001, image: '/images/art/films/mulholland-dr.jpg' },
  { title: 'There Will Be Blood',   secondary: 'Paul Thomas Anderson', year: 2007, image: '/images/art/films/there-will-be-blood.jpg' },
  { title: 'The Grand Budapest Hotel', secondary: 'Wes Anderson',      year: 2014, image: '/images/art/films/grand-budapest-hotel.jpg' },
];

export const BOOKS: ArtItem[] = [
  { title: 'The Master and Margarita', secondary: 'Mikhail Bulgakov', year: 1967, image: '/images/art/books/master-and-margarita.jpg' },
  { title: 'The Stranger',             secondary: 'Albert Camus',     year: 1942, image: '/images/art/books/the-stranger.jpg' },
];
