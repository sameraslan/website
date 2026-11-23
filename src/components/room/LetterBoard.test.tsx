import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BLOG_NAME, type RoomPost } from '@/lib/room';
import { LetterBoard } from './LetterBoard';
import { NEWER_POSTS, OLDER_POSTS } from './copy';

const makePosts = (n: number): RoomPost[] =>
  Array.from({ length: n }, (_, i) => ({
    href: `/notes/example-${i}`,
    title: `Example post ${i}`,
    date: `2026-01-${String(28 - i).padStart(2, '0')}`,
    dateLabel: `Jan ${28 - i}, 2026`,
  }));

const titles = () => screen.getAllByRole('link').map((a) => a.textContent);

describe('LetterBoard', () => {
  it('shows the blog name as the heading and hides the pager for one page', () => {
    render(<LetterBoard posts={makePosts(6)} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(BLOG_NAME);
    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('pages through posts six at a time with older and newer buttons', () => {
    render(<LetterBoard posts={makePosts(13)} />);
    expect(titles()[0]).toContain('Example post 0');
    expect(screen.queryByText(NEWER_POSTS)).toBeNull();

    fireEvent.click(screen.getByText(OLDER_POSTS));
    expect(titles()).toHaveLength(6);
    expect(titles()[0]).toContain('Example post 6');
    expect(screen.getByText(NEWER_POSTS)).toBeTruthy();
    expect(screen.getByText(OLDER_POSTS)).toBeTruthy();

    fireEvent.click(screen.getByText(OLDER_POSTS));
    expect(titles()).toHaveLength(1);
    expect(screen.queryByText(OLDER_POSTS)).toBeNull();

    fireEvent.click(screen.getByText(NEWER_POSTS));
    expect(titles()[0]).toContain('Example post 6');
  });
});
