'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { BLOG_NAME, paginate, type RoomPost } from '@/lib/room';
import { BYLINE, NEWER_POSTS, OLDER_POSTS, PAGER_LABEL, POSTS_NAV_LABEL, TAGLINE } from './copy';

// The felt letter board: blog name, tagline, one page of posts, byline and pager.
// Plain text throughout, so it paints before any artwork and stays selectable.
// onHoverChange reports the pointer entering and leaving the board (in reading
// mode it brings the board forward and holds off the room tour); onFocusIn fires when keyboard focus moves into the board and
// onFocusOut when it leaves the board altogether.
export function LetterBoard({
  posts,
  onHoverChange,
  onFocusIn,
  onFocusOut,
}: {
  posts: RoomPost[];
  onHoverChange?: (over: boolean) => void;
  onFocusIn?: () => void;
  onFocusOut?: () => void;
}) {
  const pages = paginate(posts);
  const [pageIndex, setPageIndex] = useState(0);
  const page = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const shown = pages[page] ?? [];
  const hasNewer = page > 0;
  const hasOlder = page < pages.length - 1;

  return (
    <>
      <div className="gp-chain gp-bd-chain" style={{ left: -570, top: -530, height: 150 }} aria-hidden="true" />
      <div className="gp-chain gp-bd-chain" style={{ left: -78, top: -530, height: 150 }} aria-hidden="true" />
      <div
        className="gp-obj gp-board"
        onPointerEnter={onHoverChange && (() => onHoverChange(true))}
        onPointerLeave={onHoverChange && (() => onHoverChange(false))}
        onFocus={onFocusIn}
        onBlur={
          onFocusOut &&
          ((e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusOut();
          })
        }
      >
        <div className="gp-bd-felt">
          {/* The name's length lets the flat page size the title to fit (room.css). */}
          <h1 className="gp-bd-title" style={{ '--gp-len': BLOG_NAME.length } as CSSProperties}>
            {BLOG_NAME}
          </h1>
          <p className="gp-bd-desc">{TAGLINE}</p>
          <nav className="gp-bd-list" aria-label={POSTS_NAV_LABEL}>
            <ul key={page}>
              {shown.map((post) => (
                <li key={post.href}>
                  <Link className="gp-bd-post" href={post.href}>
                    <span className="gp-bd-pt">{post.title}</span>
                    <time className="gp-bd-pd" dateTime={post.date}>
                      {post.dateLabel}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="gp-bd-foot">
            <span className="gp-bd-by">{BYLINE}</span>
            {pages.length > 1 && (
              <div className="gp-bd-pager" role="group" aria-label={PAGER_LABEL}>
                {hasNewer && (
                  <button type="button" className="gp-bd-pg" onClick={() => setPageIndex(page - 1)}>
                    {NEWER_POSTS}
                  </button>
                )}
                {hasOlder && (
                  <button type="button" className="gp-bd-pg" onClick={() => setPageIndex(page + 1)}>
                    {OLDER_POSTS}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
