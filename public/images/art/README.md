# Art covers

Drop cover images into the matching subfolder. Filenames must match the
`image` path defined for each entry in `src/lib/art-data.ts`.

If a cover is missing, the page renders a typography fallback card with the
title and artist/director/author in serif, so the page still looks fine while
you collect images.

## Recommended specs

- Albums: square. 600x600 or larger. JPEG.
- Films: 2:3 portrait poster. ~500x750 or larger. JPEG.
- Books: 2:3 portrait. ~400x600 or larger. JPEG.

Next.js will optimize automatically.

## Filenames the page expects right now

### albums/
- future-days.jpg                       (Can)
- long-season.jpg                       (Fishmans)
- black-saint-and-the-sinner-lady.jpg   (Mingus)
- madvillainy.jpg                       (Madvillain)
- loveless.jpg                          (My Bloody Valentine)
- minimal-nation.jpg                    (Robert Hood)
- lanquidity.jpg                        (Sun Ra)

### films/
- 12-angry-men.jpg
- battle-of-algiers.jpg
- high-and-low.jpg
- harakiri.jpg
- mulholland-dr.jpg
- no-country-for-old-men.jpg
- grand-budapest-hotel.jpg

### books/
- master-and-margarita.jpg
- the-stranger.jpg

## Workflow for adding new entries

1. Grab the cover (RYM/Wikipedia for albums, IMDb/Letterboxd for films,
   Goodreads/Open Library for books).
2. Save it into the right subfolder with a kebab-case filename.
3. Add one entry to `src/lib/art-data.ts` pointing at that filename.
4. Push.
