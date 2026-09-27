// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AboutHeader } from './AboutHeader';

// Pinned verbatim from the approved bio copy. If this string ever needs to
// change, the bio text itself changed and that is a content decision, not a
// layout one.
const FIRST_PARAGRAPH =
  "I'm passionate about using knowledge about the human brain to " +
  'build models that blend machine learning with engineering to develop ' +
  'innovative solutions that create meaningful and positive experiences ' +
  'for people. These days, I work at the intersection of AI and law.';

describe('AboutHeader', () => {
  it('keeps the bio text exactly as approved', () => {
    render(<AboutHeader />);
    expect(document.body.textContent).toContain(FIRST_PARAGRAPH);
  });

  it('links to email, github, and linkedin using siteConfig.external', () => {
    render(<AboutHeader />);

    const email = screen.getByRole('link', { name: /email/i });
    const github = screen.getByRole('link', { name: /github/i });
    const linkedin = screen.getByRole('link', { name: /linkedin/i });

    expect(email.getAttribute('href')).toBe('mailto:samer.aslan@gmail.com');
    expect(github.getAttribute('href')).toBe('https://github.com/sameraslan');
    expect(linkedin.getAttribute('href')).toBe(
      'https://www.linkedin.com/in/sameraslan/'
    );
  });

  it('renders the four facts labels in the sidebar', () => {
    render(<AboutHeader />);

    expect(screen.getByText('now')).toBeTruthy();
    expect(screen.getByText('before')).toBeTruthy();
    expect(screen.getByText('where')).toBeTruthy();
    expect(screen.getByText('listening lately')).toBeTruthy();
  });

  it('does not render the old standalone location caption', () => {
    render(<AboutHeader />);
    // "Brooklyn, New York" now lives only as the dd value of the "where" row.
    const matches = screen.getAllByText('Brooklyn, New York');
    expect(matches).toHaveLength(1);
  });
});
