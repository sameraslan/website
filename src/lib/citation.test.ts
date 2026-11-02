import { describe, it, expect } from 'vitest';
import { parseEntry } from './content';
import { citationMeta } from './citation';

const WITH_CITATION = `---
title: "Alpha"
links:
  paper: "/papers/alpha.pdf"
citation:
  title: "Alpha: A Full Paper Title"
  authors: ["Samer Aslan", "Jane Doe"]
  date: "2023/12"
  institution: "Johns Hopkins University"
---

Body.
`;

describe('citationMeta', () => {
  it('builds Scholar tags for a paper hosted on the site', () => {
    const meta = citationMeta(parseEntry(WITH_CITATION, 'alpha', 'alpha.mdx'));
    expect(meta).toEqual({
      citation_title: 'Alpha: A Full Paper Title',
      citation_author: ['Samer Aslan', 'Jane Doe'],
      citation_publication_date: '2023/12',
      citation_technical_report_institution: 'Johns Hopkins University',
      citation_pdf_url: 'https://www.sameraslan.com/papers/alpha.pdf',
    });
  });

  it('skips papers hosted elsewhere', () => {
    const raw = WITH_CITATION.replace('/papers/alpha.pdf', 'https://arxiv.org/abs/1234.5678');
    expect(citationMeta(parseEntry(raw, 'alpha', 'alpha.mdx'))).toBeUndefined();
  });

  it('skips entries without a citation block', () => {
    expect(citationMeta(parseEntry('---\ntitle: "Beta"\n---\n', 'beta', 'beta.mdx'))).toBeUndefined();
  });
});
