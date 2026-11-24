import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ALBUMS, CRATE_ALBUMS, albumsByArtist } from '@/lib/room';
import { CRATE_TITLE } from './copy';
import { CrateView } from './CrateView';

describe('the record crate', () => {
  it('holds all 90 albums, by artist, two of them without a cover', () => {
    expect(CRATE_ALBUMS).toHaveLength(90);
    expect(CRATE_ALBUMS.map((a) => a.id)).toEqual(albumsByArtist(ALBUMS).map((a) => a.id));
    expect(CRATE_ALBUMS.filter((a) => !a.hasCover)).toHaveLength(2);
  });

  it('renders a labelled modal dialog with a button per album and two white-label sleeves', () => {
    const { container } = render(<CrateView open covered={false} onClose={() => {}} onOpenAlbum={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: CRATE_TITLE });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const list = within(dialog).getByRole('list');
    expect(within(list).getAllByRole('button')).toHaveLength(90);
    expect(container.querySelectorAll('.gp-cr-item .gp-wl')).toHaveLength(2);
    expect(container.querySelectorAll('.gp-cr-item img[loading="lazy"]')).toHaveLength(88);
  });

  it('opens a white-label album as a sleeve piece and a covered one as an image piece', () => {
    const onOpenAlbum = vi.fn();
    render(<CrateView open covered={false} onClose={() => {}} onOpenAlbum={onOpenAlbum} />);
    const noCover = ALBUMS.find((a) => !a.hasCover)!;
    fireEvent.click(screen.getByRole('button', { name: `${noCover.artist}, ${noCover.title}, ${noCover.year}` }));
    expect(onOpenAlbum).toHaveBeenLastCalledWith({ sleeve: true, title: noCover.title, artist: noCover.artist, year: noCover.year });
    const covered = ALBUMS.find((a) => a.hasCover)!;
    fireEvent.click(screen.getByRole('button', { name: `${covered.artist}, ${covered.title}, ${covered.year}` }));
    expect(onOpenAlbum.mock.lastCall?.[0]).toMatchObject({ title: covered.title, width: covered.width });
  });

  it('closes from the Close button and from a click on the backdrop', () => {
    const onClose = vi.fn();
    render(<CrateView open covered={false} onClose={onClose} onOpenAlbum={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing while closed', () => {
    const { container } = render(<CrateView open={false} covered={false} onClose={() => {}} onOpenAlbum={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
