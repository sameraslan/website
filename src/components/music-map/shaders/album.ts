export const ALBUM_VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_pos_audio;
  attribute vec2 a_pos_balanced;
  attribute vec2 a_pos_mood;
  attribute vec4 a_atlasUV;       // (u, v, w, h)
  attribute float a_atlasIndex;   // float so vertex attribs work
  attribute float a_clusterId;

  uniform float u_sliderT;
  uniform float u_zoomT;
  uniform float u_pixelRatio;
  uniform float u_focusedAlbumIndex;
  uniform float u_neighborMask[12];  // indices of focused + neighbors (10 + 1 + sentinel)
  uniform vec2 u_cursor;
  uniform float u_cursorActive;

  varying vec2 v_atlasOrigin;
  varying vec2 v_atlasSize;
  varying float v_atlasIndex;
  varying float v_clusterId;
  varying float v_dim;          // 0 = full opacity, 1 = dimmed in focus mode
  varying float v_screenSize;   // pixels

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

    vec4 mvPos = modelViewMatrix * vec4(worldPos, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float baseSize = 6.0 + u_zoomT * 80.0;  // px
    float scale = 1.0;
    v_dim = 0.0;
    if (u_focusedAlbumIndex >= 0.0) {
      if (isHighlighted(instanceIndex)) {
        scale = 1.15;
      } else {
        v_dim = 0.7;
      }
    }
    // Clamp at 240 device-px: most desktop GPUs cap GL_POINTS sprites around
    // 256, so without this a high-DPR (3x) viewport at max zoom asks for a
    // ~300px sprite and the driver silently culls the entire point — the
    // user sees the focused album vanish into the paper background.
    gl_PointSize = min(baseSize * scale * u_pixelRatio, 240.0);
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

  varying vec2 v_atlasOrigin;
  varying vec2 v_atlasSize;
  varying float v_atlasIndex;
  varying float v_clusterId;
  varying float v_dim;
  varying float v_screenSize;

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
    float discMask = 1.0 - smoothstep(0.5 - aa, 0.5, r);
    if (discMask <= 0.0) discard;

    // Authored in sRGB; ShaderMaterial does not auto-apply the
    // linear->sRGB output conversion, so we write the literal hex
    // values straight to the framebuffer.
    vec3 ink = vec3(0.137, 0.114, 0.078);   // #231d14
    vec3 paper = vec3(0.980, 0.965, 0.926); // #faf6ec
    vec3 cluster = clusterColor(int(v_clusterId));
    vec3 dotColor = mix(ink, cluster, 0.3);
    vec3 col;

    // Cover mode kicks in once a sprite is large enough on screen to read.
    // Compare in CSS pixels by dividing out the pixel ratio baked into
    // v_screenSize (gl_PointSize is in device pixels).
    if (v_screenSize < 24.0) {
      // Dot mode — tint by cluster color, mostly ink
      col = dotColor;
    } else {
      // Cover mode — sample atlas in [0,1] using atlasUV
      vec2 uvInAtlas = v_atlasOrigin + gl_PointCoord * v_atlasSize;
      vec4 cover = sampleAtlas(int(v_atlasIndex), uvInAtlas);
      if (cover.a < 0.5) {
        // Atlas not loaded yet — keep the dot color so the album never
        // collapses to pure black while we wait for textures.
        col = dotColor;
      } else {
        // Multiply blend with paper — sits in the page
        col = paper * cover.rgb;
      }
    }

    col = mix(col, paper, v_dim);
    gl_FragColor = vec4(col, discMask);
  }
`;

export const CLUSTER_COLORS_RGB: [number, number, number][] = [
  [0x5b / 255, 0x78 / 255, 0x55 / 255], // sage
  [0x7c / 255, 0x82 / 255, 0x55 / 255], // olive
  [0x3a / 255, 0x66 / 255, 0x55 / 255], // forest
  [0x8a / 255, 0x3a / 255, 0x2a / 255], // oxblood
  [0xb6 / 255, 0x53 / 255, 0x2a / 255], // terracotta
  [0xa8 / 255, 0x94 / 255, 0x5c / 255], // amber
  [0x5a / 255, 0x70 / 255, 0x80 / 255], // slate
  [0x6a / 255, 0x48 / 255, 0x60 / 255], // plum
];
