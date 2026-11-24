import type { Metadata } from 'next';
import { NOTE_ROBOTS } from '@/lib/notes';
import { BLOG_NAME } from '@/lib/room';
import { loadRoomPosts } from '@/lib/room-posts';
import { RoomPage } from '@/components/room/RoomPage';

// The blog landing page. It lives outside the (pages) group so it escapes the
// centred PageFrame, is served noindex/nofollow and is linked from nowhere.
export const metadata: Metadata = {
  title: `${BLOG_NAME} · samer aslan`,
  robots: NOTE_ROBOTS,
};

export default async function NotesIndex() {
  const posts = await loadRoomPosts();
  return <RoomPage posts={posts} />;
}
