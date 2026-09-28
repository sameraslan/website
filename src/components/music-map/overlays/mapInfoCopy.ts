/**
 * Copy for the map's "about this map" popover (MapInfo.tsx). Kept in one
 * place so it can be edited without touching the component. One string per
 * paragraph.
 *
 * Facts behind it (see README.md and pipeline/config.yaml):
 * - The slider interpolates each dot between three precomputed UMAP layouts:
 *   audio (Spotify audio features only), balanced (half and half), and mood
 *   (RateYourMusic descriptors only).
 * - Colours come from KMeans clusters fitted once on the balanced features,
 *   so they mix sound and descriptors and do not change with the slider.
 */
export const MAP_INFO_TITLE = "about this map";

export const MAP_INFO_PARAGRAPHS: readonly string[] = [
  "Each dot is an album I’ve rated. Albums close together sound alike.",
  "The slider changes what “alike” means. Toward audio, albums are placed by sound features like energy, danceability, and valence. Toward mood, they’re placed by how listeners describe them on RateYourMusic, with words like warm and ethereal.",
  "Colors mark broad groups of albums, found from sound and descriptions together.",
];
