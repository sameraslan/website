import { existsSync } from 'node:fs';
import path from 'node:path';
import { ALBUMS, FILMS, BOOKS, type ArtItem } from './art-data';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function resolve(item: ArtItem): ArtItem {
  if (item.image && existsSync(path.join(PUBLIC_DIR, item.image))) return item;
  return { ...item, image: undefined };
}

export const getAlbums = (): ArtItem[] => ALBUMS.map(resolve);
export const getFilms  = (): ArtItem[] => FILMS.map(resolve);
export const getBooks  = (): ArtItem[] => BOOKS.map(resolve);
