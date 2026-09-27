# music-catalog

Restricts the music map to albums rated on RateYourMusic. The full
4081-album pipeline output (from the `music_map` worktree's `pipeline/`)
carries the audio/mood features; this keeps the subset that also appears in
the RYM export with a rating above 0, fills `year` from RYM's release date,
and repacks the covers into as few atlas sheets as needed. Positions are the
original UMAP coordinates, unchanged.

```bash
mkdir -p /tmp/catalog /tmp/rym
for f in metadata.json positions.json regions.json atlas-0.webp atlas-1.webp atlas-2.webp atlas-3.webp; do
  git show d9996d1:public/data/$f > /tmp/catalog/$f
done
python3 scripts/music-catalog/match_rym.py /tmp/catalog "path/to/Music Export.csv" /tmp/rym
node scripts/music-catalog/build.mjs /tmp/catalog /tmp/rym
```

`d9996d1` is the last commit with the full catalog in `public/data/`.
`overrides.json` fixes matches the name matcher gets wrong (a sibling album's
row attached to the right catalog id, or names it cannot align, such as
"native [romanized]" artist strings). Review `unmatched.json` after a new
export and add entries there as needed.
