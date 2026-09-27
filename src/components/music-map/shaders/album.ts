/**
 * Exponent P of the sprite size curve
 * `cssSize = clamp(10 * (zoom / fitZoom)^P, 4, 90)`.
 *
 * The real fitZoom is about 1.01 at the default sliderT 0.6 on a 1440 x 900
 * viewport (percentile framing against a frustum 1.1 world units tall and
 * 1.1 * aspect wide, see InitialFrame, so it shifts with the viewport's
 * aspect ratio once the width becomes the limiting axis). At
 * TUNING.focusZoom = 4 the ratio is
 * 4 / 1.01 = 3.96, and a readable focused cover needs >= 60px, i.e.
 * 3.96^P >= 6, P >= ln(6) / ln(3.96) = 1.79 / 1.38 = 1.30. Aiming for the
 * brief's 6.5x headroom gives ln(6.5) / ln(3.96) = 1.87 / 1.38 = 1.36, so
 * P = 1.4, which yields:
 *   1.0x fit: 10px (overview discs)
 *   1.9x fit: 24.6px (crossfade starts; AtlasManager's load gate)
 *   2.5x fit: 36px (covers mostly faded in)
 *   2.7x fit: 40px (crossfade complete)
 *   3.96x fit (zoom 4): 68.8px (focused cover)
 *   4.95x fit (zoom 5): 94px, clamped to 90px
 */
export const SIZE_CURVE_POWER = 1.4;

/**
 * JS mirror of the vertex shader's base sprite size in CSS px (before the
 * focus/hover scale, dpr and point-size caps). Used by the dev-only
 * `getSpriteCssSize()` debug getter; keep in sync with `baseSize` below.
 */
export function spriteCssSize(zoom: number, fitZoom: number): number {
  const s = 10 * Math.pow(zoom / Math.max(fitZoom, 0.0001), SIZE_CURVE_POWER);
  return Math.min(90, Math.max(4, s));
}

export const ALBUM_VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_pos_audio;
  attribute vec2 a_pos_balanced;
  attribute vec2 a_pos_mood;
  attribute vec4 a_atlasUV;       // (u, v, w, h)
  attribute float a_atlasIndex;   // float so vertex attribs work
  attribute float a_clusterId;

  uniform float u_sliderT;
  uniform float u_zoomT;
  uniform float u_zoom;   // real camera.zoom (dynamic min..5), not normalized
  uniform float u_fitZoom; // zoom at which the whole album cloud fits the frustum
  uniform float u_pixelRatio;
  uniform float u_focusedAlbumIndex;
  uniform float u_neighborMask[12];  // indices of focused + neighbors (10 + 1 + sentinel)
  uniform vec2 u_cursor;
  uniform float u_cursorActive;
  uniform float u_hoverIndex;   // -1 = no hover target
  uniform float u_maxSpritePx;  // device px cap, viewportHeightCssPx * 0.18 * dpr

  varying vec2 v_atlasOrigin;
  varying vec2 v_atlasSize;
  varying float v_atlasIndex;
  varying float v_clusterId;
  varying float v_dim;          // 0 = full opacity, 1 = dimmed in focus mode
  varying float v_screenSize;   // pixels
  varying float v_hovered;      // 1 = this instance is the hover target

  vec2 interpolatePos() {
    if (u_sliderT <= 0.5) {
      float t = u_sliderT * 2.0;
      return mix(a_pos_audio, a_pos_balanced, t);
    }
    float t = (u_sliderT - 0.5) * 2.0;
    return mix(a_pos_balanced, a_pos_mood, t);
  }

  bool isHighlighted(float instanceIndex) {
    for (int i = 0; i < 12; i++) {
      if (abs(u_neighborMask[i] - instanceIndex) < 0.5) return true;
    }
    return false;
  }

  void main() {
    float instanceIndex = float(gl_InstanceID);
    vec2 worldPos = interpolatePos();

    vec2 toCursor = u_cursor - worldPos;
    float d = length(toCursor);
    float pullRadius = 0.12;
    float pullStrength = 0.018 * u_cursorActive;
    float falloff = 1.0 - smoothstep(0.0, pullRadius, d);
    worldPos += normalize(toCursor + vec2(0.0001)) * (falloff * falloff * pullStrength);

    // Draw-order layers via depth (the material writes depth, LessEqual
    // test). All albums share one instanced draw, so without this a later
    // instance paints over an earlier one; in focus mode a highlighted
    // neighbour at 1.15x could cover the focused album entirely, showing the
    // wrong cover under the focused album's tooltip (task 8 fix round 5).
    // Layers, toward the camera: focused 0.3 > hovered 0.2 > highlighted
    // neighbour 0.1 > everything else 0.0. Same-layer sprites keep plain
    // painter's order, so the overview (all 0.0) is unchanged.
    float layer = 0.0;
    if (u_focusedAlbumIndex >= 0.0 && isHighlighted(instanceIndex)) layer = 0.1;
    if (abs(u_hoverIndex - instanceIndex) < 0.5) layer = 0.2;
    if (abs(u_focusedAlbumIndex - instanceIndex) < 0.5) layer = 0.3;

    vec4 mvPos = modelViewMatrix * vec4(worldPos, layer, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Power curve of the real camera zoom relative to u_fitZoom (the fitted
    // overview zoom, state/view.ts), so the overview always reads as ~10px
    // tinted discs and covers become legible as the user zooms in relative
    // to that fit. See SIZE_CURVE_POWER below for the exponent's arithmetic.
    // Clamped to [4, 90] CSS px before the scale/dpr/ring multipliers below.
    float baseSize = clamp(10.0 * pow(u_zoom / max(u_fitZoom, 0.0001), ${SIZE_CURVE_POWER.toFixed(2)}), 4.0, 90.0);  // px
    float scale = 1.0;
    v_dim = 0.0;
    if (u_focusedAlbumIndex >= 0.0) {
      if (isHighlighted(instanceIndex)) {
        scale = 1.15;
      } else {
        v_dim = 0.7;
        // Dimmed sprites also shrink so they recede rather than smearing
        // paper on paper at full size (spec 4.3).
        scale = 0.85;
      }
    }
    v_hovered = (abs(u_hoverIndex - instanceIndex) < 0.5) ? 1.0 : 0.0;
    if (v_hovered > 0.5) {
      scale = 1.25;
    }
    // Clamp at 240 device-px (most desktop GPUs cap GL_POINTS sprites around
    // 256, so without this a high-DPR viewport at max zoom asks for a sprite
    // large enough that the driver silently culls the whole point) and at
    // u_maxSpritePx (a viewport-relative cap so a single album cover never
    // dominates a short viewport at max zoom).
    gl_PointSize = min(baseSize * scale * u_pixelRatio, min(240.0, u_maxSpritePx));
    v_screenSize = gl_PointSize;

    v_atlasOrigin = a_atlasUV.xy;
    v_atlasSize = a_atlasUV.zw;
    v_atlasIndex = a_atlasIndex;
    v_clusterId = a_clusterId;
  }
`;

export const ALBUM_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D u_atlas0;
  uniform sampler2D u_atlas1;
  uniform sampler2D u_atlas2;
  uniform sampler2D u_atlas3;
  uniform sampler2D u_atlas4;
  uniform float u_atlasLoaded[5];  // 0/1 flags
  uniform vec3 u_clusterColors[8];
  uniform float u_pixelRatio;

  varying vec2 v_atlasOrigin;
  varying vec2 v_atlasSize;
  varying float v_atlasIndex;
  varying float v_clusterId;
  varying float v_dim;
  varying float v_screenSize;
  varying float v_hovered;

  // Returns vec4(rgb, loaded) where loaded = 1.0 if the atlas was sampled,
  // 0.0 if the atlas isn't loaded yet (caller falls back to the dot color).
  vec4 sampleAtlas(int idx, vec2 uv) {
    if (idx == 0 && u_atlasLoaded[0] > 0.5) return vec4(texture2D(u_atlas0, uv).rgb, 1.0);
    if (idx == 1 && u_atlasLoaded[1] > 0.5) return vec4(texture2D(u_atlas1, uv).rgb, 1.0);
    if (idx == 2 && u_atlasLoaded[2] > 0.5) return vec4(texture2D(u_atlas2, uv).rgb, 1.0);
    if (idx == 3 && u_atlasLoaded[3] > 0.5) return vec4(texture2D(u_atlas3, uv).rgb, 1.0);
    if (idx == 4 && u_atlasLoaded[4] > 0.5) return vec4(texture2D(u_atlas4, uv).rgb, 1.0);
    return vec4(0.0);
  }

  vec3 clusterColor(int id) {
    if (id == 0) return u_clusterColors[0];
    if (id == 1) return u_clusterColors[1];
    if (id == 2) return u_clusterColors[2];
    if (id == 3) return u_clusterColors[3];
    if (id == 4) return u_clusterColors[4];
    if (id == 5) return u_clusterColors[5];
    if (id == 6) return u_clusterColors[6];
    return u_clusterColors[7];
  }

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    float aa = fwidth(r);

    // Authored in sRGB; ShaderMaterial does not auto-apply the
    // linear->sRGB output conversion, so we write the literal hex
    // values straight to the framebuffer.
    vec3 ink = vec3(0.137, 0.114, 0.078);   // #231d14
    vec3 paper = vec3(0.980, 0.965, 0.926); // #faf6ec

    // Ring geometry, expressed in gl_PointCoord's r-space. One device pixel
    // measured against the sprite's on-screen diameter (v_screenSize, in
    // device px) is 1/v_screenSize in this space, since r=0.5 spans half
    // that diameter. The point sprite is a square clipped at r=0.5 on its
    // edges, so everything, rings included, must fit inside r <= 0.5: on a
    // hovered sprite (already 1.25x bigger, see the vertex shader) the disc
    // ends 3px short of the sprite edge, a 1px ink ring follows, and a 2px
    // paper ring runs out to r=0.5.
    float pxR = 1.0 / max(v_screenSize, 1.0);
    float discEdge = v_hovered > 0.5 ? 0.5 - 3.0 * pxR : 0.5;
    float inkOuter = 0.5 - 2.0 * pxR;

    float discMask = 1.0 - smoothstep(0.5 - aa, 0.5, r);
    if (discMask <= 0.0) discard;
    // Dot mode is the full cluster color at full strength, no ink mix, so
    // the overview reads as coloured structure (spec 4.3).
    vec3 dotColor = clusterColor(int(v_clusterId));
    vec3 col;

    // Cover mode kicks in once a sprite is large enough on screen to read.
    // Compare in CSS pixels by dividing out the pixel ratio baked into
    // v_screenSize (gl_PointSize is in device pixels).
    float cssSize = v_screenSize / max(u_pixelRatio, 0.0001);

    if (cssSize < 24.0) {
      // Dot mode: full cluster color
      col = dotColor;
    } else {
      // Cover mode: sample atlas in [0,1] using atlasUV
      vec2 uvInAtlas = v_atlasOrigin + gl_PointCoord * v_atlasSize;
      vec4 cover = sampleAtlas(int(v_atlasIndex), uvInAtlas);
      vec3 coverColor;
      if (cover.a < 0.5) {
        // Atlas not loaded yet, keep the dot color so the album never
        // collapses to pure black while we wait for textures.
        coverColor = dotColor;
      } else {
        // Multiply blend with paper: sits in the page
        coverColor = paper * cover.rgb;
      }
      // Crossfade from the disc color to the cover between 24 and 40 CSS px
      // so the switch reads as a fade, not a pop.
      float coverT = smoothstep(24.0, 40.0, cssSize);
      col = mix(dotColor, coverColor, coverT);
    }

    // v_dim (paper mix) only applies in focus mode, unchanged from before.
    col = mix(col, paper, v_dim);

    // Ring band: r in (discEdge, 0.5] on a hovered sprite. inkMask fades
    // from ink (right at the disc edge) to paper (further out), giving a
    // 1px ink ring immediately outside the disc and a 2px paper ring beyond
    // it. The ring takes the same v_dim paper mix as the disc, so a hovered
    // but dimmed album in focus mode does not show a full-strength ring.
    if (v_hovered > 0.5) {
      float inkMask = 1.0 - smoothstep(inkOuter - aa, inkOuter, r);
      vec3 ringCol = mix(mix(paper, ink, inkMask), paper, v_dim);
      col = mix(col, ringCol, smoothstep(discEdge - aa, discEdge, r));
    }

    gl_FragColor = vec4(col, discMask);
  }
`;
