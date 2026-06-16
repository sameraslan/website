import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadEntries, loadEntry, type Entry } from './content';

const FIXTURE_DIR = path.join(process.cwd(), 'src', 'content', '__test__');

const ALPHA = `---
title: "Alpha"
subtitle: "First entry"
year: 2024
role: "Author"
stack: ["TypeScript"]
links: { github: "https://example.com/alpha" }
order: 2
---

Body of alpha.
`;

const BETA = `---
title: "Beta"
subtitle: "Second entry"
year: 2023
role: "Author"
stack: ["Python"]
order: 1
---

Body of beta.
`;

const NO_FRONTMATTER = `Just a body, no frontmatter.`;

beforeAll(async () => {
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURE_DIR, 'alpha.mdx'), ALPHA);
  await fs.writeFile(path.join(FIXTURE_DIR, 'beta.mdx'),  BETA);
  await fs.writeFile(path.join(FIXTURE_DIR, 'bad.mdx'),   NO_FRONTMATTER);
});

afterAll(async () => {
  await fs.rm(FIXTURE_DIR, { recursive: true, force: true });
});

describe('content loader', () => {
  it('loads entries from a directory', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.map((e: Entry) => e.slug).sort()).toEqual(['alpha', 'beta']);
  });

  it('sorts by order ascending, then year descending', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.map((e) => e.slug)).toEqual(['beta', 'alpha']);
  });

  it('parses frontmatter into typed fields', async () => {
    const beta = await loadEntry('__test__', 'beta');
    expect(beta.title).toBe('Beta');
    expect(beta.year).toBe(2023);
    expect(beta.stack).toEqual(['Python']);
    expect(beta.body.trim()).toBe('Body of beta.');
  });

  it('throws a clear error when slug missing', async () => {
    await expect(loadEntry('__test__', 'missing')).rejects.toThrow(/no content/i);
  });

  it('skips files with no frontmatter rather than crashing', async () => {
    const entries = await loadEntries('__test__');
    expect(entries.find((e) => e.slug === 'bad')).toBeUndefined();
  });
});
