export interface ClusterDef {
  id: string;
  label: string;
  cx: number;
  cy: number;
  r: number;
}

export const MM_CLUSTERS: ClusterDef[] = [
  { id: 'ambient',    label: 'ambient',         cx: 0.18, cy: 0.30, r: 0.13 },
  { id: 'drone',      label: 'drone · cold',    cx: 0.12, cy: 0.62, r: 0.11 },
  { id: 'folk',       label: 'folk · acoustic', cx: 0.38, cy: 0.20, r: 0.14 },
  { id: 'lyrical',    label: 'introspective',   cx: 0.42, cy: 0.55, r: 0.14 },
  { id: 'electronic', label: 'electronic',      cx: 0.68, cy: 0.30, r: 0.15 },
  { id: 'rock',       label: 'rock · indie',    cx: 0.72, cy: 0.62, r: 0.14 },
  { id: 'soul',       label: 'soul · r&b',      cx: 0.86, cy: 0.40, r: 0.11 },
  { id: 'jazz',       label: 'jazz · warm',     cx: 0.62, cy: 0.82, r: 0.12 },
];

export const MM_PALETTE = [
  '#3f5036', // forest
  '#5a7041', // moss
  '#7d8a5a', // sage-olive
  '#9caf6e', // light olive
  '#b8852e', // ochre
  '#c89844', // ochre-soft
  '#8a6b3e', // walnut
  '#a89970', // tan
];

// [clusterId, album title, artist]
export const MM_ALBUMS: [string, string, string][] = [
  ['ambient',    'Music for Airports',          'Eno'],
  ['ambient',    'Selected Ambient Works',      'Aphex Twin'],
  ['ambient',    'Substrata',                   'Biosphere'],
  ['ambient',    'Discreet Music',              'Eno'],
  ['ambient',    'Pop. 1280',                   'Stars of the Lid'],
  ['drone',      'The Disintegration Loops',    'Basinski'],
  ['drone',      'Black Sea',                   'Fennesz'],
  ['drone',      'Sleep',                       'Max Richter'],
  ['drone',      'Lift Yr Skinny Fists',        'GY!BE'],
  ['folk',       'For Emma, Forever Ago',       'Bon Iver'],
  ['folk',       'Pink Moon',                   'Nick Drake'],
  ['folk',       'Carrie & Lowell',             'Sufjan Stevens'],
  ['folk',       'Sea Change',                  'Beck'],
  ['folk',       'Blue',                        'Joni Mitchell'],
  ['folk',       'Benji',                       'Sun Kil Moon'],
  ['lyrical',    'In Rainbows',                 'Radiohead'],
  ['lyrical',    'Punisher',                    'Phoebe Bridgers'],
  ['lyrical',    'Stranger in the Alps',        'Phoebe Bridgers'],
  ['lyrical',    'Blonde',                      'Frank Ocean'],
  ['lyrical',    'Boys for Pele',               'Tori Amos'],
  ['lyrical',    'Norman F. Rockwell!',         'Lana Del Rey'],
  ['electronic', 'Untrue',                      'Burial'],
  ['electronic', 'Endtroducing',                'DJ Shadow'],
  ['electronic', 'Geogaddi',                    'Boards of Canada'],
  ['electronic', 'Music Has the Right',         'Boards of Canada'],
  ['electronic', 'Random Access Memories',      'Daft Punk'],
  ['electronic', 'In Colour',                   'Jamie xx'],
  ['rock',       'Loveless',                    'My Bloody Valentine'],
  ['rock',       'Souvlaki',                    'Slowdive'],
  ['rock',       'Either/Or',                   'Elliott Smith'],
  ['rock',       'Funeral',                     'Arcade Fire'],
  ['rock',       'OK Computer',                 'Radiohead'],
  ['rock',       'In the Aeroplane',            'Neutral Milk Hotel'],
  ['soul',       'Voodoo',                      "D'Angelo"],
  ['soul',       'Channel Orange',              'Frank Ocean'],
  ['soul',       'Black Messiah',               "D'Angelo"],
  ['soul',       'A Seat at the Table',         'Solange'],
  ['soul',       'When I Get Home',             'Solange'],
  ['jazz',       'Kind of Blue',                'Miles Davis'],
  ['jazz',       'A Love Supreme',              'Coltrane'],
  ['jazz',       'In a Silent Way',             'Miles Davis'],
  ['jazz',       'The Köln Concert',            'Jarrett'],
  ['jazz',       'Mulatu of Ethiopia',          'Astatke'],
  ['jazz',       'Bitches Brew',                'Miles Davis'],
];

export interface MapPoint {
  cluster: string;
  clusterIdx: number;
  x: number;
  y: number;
  size: number;
  twinkle: number;
  album: string;
  artist: string;
}

// Deterministic LCG so points don't reshuffle on re-render.
function mmRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function buildMapPoints(density = 96, seed = 7): MapPoint[] {
  const rng = mmRng(seed);
  const perCluster = Math.max(6, Math.floor(density / MM_CLUSTERS.length));
  const points: MapPoint[] = [];

  MM_CLUSTERS.forEach((c, ci) => {
    const clusterAlbums = MM_ALBUMS.filter((a) => a[0] === c.id);
    for (let i = 0; i < perCluster; i++) {
      const a = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.7) * c.r;
      const x = c.cx + Math.cos(a) * rad;
      const y = c.cy + Math.sin(a) * rad * 0.85;
      const album = clusterAlbums.length > 0 ? clusterAlbums[i % clusterAlbums.length] : null;
      points.push({
        cluster: c.id,
        clusterIdx: ci,
        x: Math.max(0.03, Math.min(0.97, x)),
        y: Math.max(0.05, Math.min(0.95, y)),
        size: 0.5 + rng() * 0.7,
        twinkle: rng(),
        album: album ? album[1] : '—',
        artist: album ? album[2] : '—',
      });
    }
  });

  return points;
}
