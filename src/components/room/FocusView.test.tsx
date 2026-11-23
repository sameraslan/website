import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusView, type FocusPiece } from './FocusView';

const piece: FocusPiece = { sleeve: true, title: 'Title', artist: 'Artist', year: '1970' };

describe('the focused view', () => {
  it('moves focus to Close on open and back to the opener on close', async () => {
    const { rerender } = render(
      <>
        <button type="button">opener</button>
        <FocusView piece={null} onClose={() => {}} />
      </>
    );
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    rerender(
      <>
        <button type="button">opener</button>
        <FocusView piece={piece} onClose={() => {}} />
      </>
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    rerender(
      <>
        <button type="button">opener</button>
        <FocusView piece={null} onClose={() => {}} />
      </>
    );
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<FocusView piece={piece} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
