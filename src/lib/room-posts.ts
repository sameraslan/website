// Server-only: builds the /notes room's post list from the notes on disk.
import { listNoteSlugs, loadNote } from './notes';
import { formatPostDate, sortPostsNewestFirst, type RoomPost } from './room';

// Every note with a valid `date`, newest first. The rule: a note appears on the
// board once its frontmatter has a `date`; until then it is skipped (a draft
// still reachable at its URL). Write the date quoted, as "yyyy-mm-dd": an
// unquoted impossible date such as 2026-02-30 is turned into a real one by the
// YAML parser before we see it.
export async function loadRoomPosts(): Promise<RoomPost[]> {
  const posts: RoomPost[] = [];
  for (const slug of await listNoteSlugs()) {
    const note = await loadNote(slug);
    if (!note.date) continue;
    posts.push({
      href: `/notes/${slug}`,
      title: note.title,
      date: note.date,
      dateLabel: formatPostDate(note.date),
    });
  }
  return sortPostsNewestFirst(posts);
}
