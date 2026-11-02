import type { Entry } from './content';

const SITE_URL = 'https://www.sameraslan.com';

// Google Scholar's inclusion guidelines ask for Highwire Press tags on the page
// that links a paper's PDF. Only entries whose PDF is hosted on this site get them.
export function citationMeta(entry: Entry): Record<string, string | string[]> | undefined {
  const pdf = entry.links?.paper;
  if (!entry.citation || !pdf || !pdf.startsWith('/')) return undefined;
  const { title, authors, date, institution } = entry.citation;
  return {
    citation_title: title,
    citation_author: authors,
    citation_publication_date: date,
    ...(institution ? { citation_technical_report_institution: institution } : {}),
    citation_pdf_url: `${SITE_URL}${pdf}`,
  };
}
