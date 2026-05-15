import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AlbumPoint {
  id: string;
  title: string;
  artist: string;
  year?: number;
  coverUrl: string;
  x: number;
  y: number;
  cluster?: string;
  size?: number;
}

export async function loadListening(): Promise<AlbumPoint[]> {
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'listening.json');
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is AlbumPoint =>
        a && typeof a.id === 'string' && typeof a.x === 'number' && typeof a.y === 'number'
    );
  } catch {
    return [];
  }
}
