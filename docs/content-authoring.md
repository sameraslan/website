# Content authoring

How to add or update content on the site. No code changes required for most updates.

## Add a project

1. Create `src/content/projects/<slug>.mdx`. The slug becomes the URL: `/projects/<slug>`.
2. Add frontmatter at the top:

   ```yaml
   ---
   title: "Project Title"
   subtitle: "One-line description shown under the title and on the projects list"
   year: 2025
   role: "Solo"                          # or "Co-lead", "Hackathon project", etc.
   stack: ["TypeScript", "Postgres"]      # appears as tiny mono chips
   links:
     site:   "https://example.com"
     github: "https://github.com/sameraslan/repo"
     demo:   "https://demo.example.com"
   order: 3                              # lower = higher in the list
   ---
   ```

3. Write the body in Markdown below the frontmatter. Headings (`##`, `###`), links, lists, code blocks, blockquotes all work — they're styled by `.prose-mdx` in `src/app/globals.css`.
4. The page builds automatically. Visit `/projects/<slug>` in dev.

### Frontmatter reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Card heading and detail-page title |
| `subtitle` | string | no | One-line description, ink-muted |
| `year` | number | no | Appears top-right of the card and in the detail metadata strip |
| `role` | string | no | "Solo", "Hackathon project", etc. |
| `stack` | string[] | no | Mono chips; lowercase recommended |
| `links.github` | url | no | Renders as "github" link |
| `links.site` | url | no | Renders as "site" link |
| `links.demo` | url | no | Renders as "demo" link |
| `links.paper` | url | no | Renders as "paper" link |
| `heroImage` | path | no | Reserved for a future hero-image block; not currently rendered |
| `order` | number | no | Sort key. Ascending. Missing = last. Tie-break: year descending. |

## Add a research entry

Same as a project. File goes under `src/content/research/<slug>.mdx`. URL: `/research/<slug>`.

The frontmatter accepts one extra field:

```yaml
affiliation: "JHU CLSP"   # rendered as a mono caption on the card and detail
```

The `links` block has the same shape; on research pages, `github` is labeled "code".

## Update `/about`

`src/app/about/page.tsx`. The avatar lives at `public/images/avatar.jpg` — replace the file to swap it (keep the dimensions 1:1, ≥560px each side so it's sharp on retina).

Bio paragraphs are plain JSX. Edit the file.

## Update `/now`

`src/app/now/page.tsx`. Two things to keep in mind:

1. Update the paragraphs.
2. **Bump the `LAST_UPDATED` constant** at the top of the file. The footer line displays this. The point of a `/now` page is the date — readers should know how stale the snapshot is.

## Update `/misc`

`src/app/misc/page.tsx`. Each section is a `<section>` with an `h2` and a paragraph. Add sections, remove sections, link to anything you want. No schema.

## Update the music-map data

Edit `public/data/listening.json`. Schema:

```json
{
  "id": "unique-string",
  "title": "Album Title",
  "artist": "Artist Name",
  "year": 1972,
  "x": 0.27,
  "y": 0.71,
  "cluster": "olive",
  "coverUrl": ""
}
```

`x` and `y` are normalized to the visualization canvas. `cluster` accepts: `sage`, `olive`, `forest`, `oxblood`, `terracotta`, `amber`, `slate`, `plum`.

Once the parallel viz session lands, positions may be generated from an audio embedding instead of hand-placed — at which point this file becomes machine-generated rather than hand-edited.

## Update nav or external links

Edit `src/lib/site-config.ts`. The `nav` array drives the sidebar / mobile-nav order; the `external` array drives `email / github / linkedin` (and any future links).

## Update the homepage tagline

`src/lib/site-config.ts` → `tagline`. Appears as the italic caption under the music map on `/`.

## Tone

Lowercase nav and section labels. Sentence case in body. No uppercase styling. Em dashes are fine (—). Sage is the only accent color — don't reach for highlights.
