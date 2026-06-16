export const WASH_VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_centroid_audio;
  attribute vec2 a_centroid_balanced;
  attribute vec2 a_centroid_mood;
  attribute float a_radius;
  attribute vec3 a_color;

  uniform float u_sliderT;
  uniform float u_zoomT;

  varying vec3 v_color;
  varying vec2 v_uv;
  varying float v_radius;

  vec2 interpolateCentroid() {
    if (u_sliderT <= 0.5) {
      return mix(a_centroid_audio, a_centroid_balanced, u_sliderT * 2.0);
    }
    return mix(a_centroid_balanced, a_centroid_mood, (u_sliderT - 0.5) * 2.0);
  }

  void main() {
    vec2 center = interpolateCentroid();
    // 'position' is a [-1,1] quad — scale to radius * 2 around the centroid
    vec2 world = center + position.xy * a_radius * 2.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
    v_color = a_color;
    v_uv = position.xy;
    v_radius = a_radius;
  }
`;

export const WASH_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float u_zoomT;

  varying vec3 v_color;
  varying vec2 v_uv;
  varying float v_radius;

  // Paper color, matches BackgroundLayer (#faf6ec). We multiply / blend the
  // wash *into* paper inside the shader and output an opaque pixel — that
  // way no alpha channel is involved, so the wash never bleeds white
  // through the framebuffer (the regression we hit in Batch 1).
  const vec3 paper = vec3(0.980, 0.965, 0.926);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }
  // Cheap fbm for soft, irregular wash interior.
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += noise(p) * a;
      p *= 2.07;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // v_uv is in [-0.5, 0.5] across the wash quad (PlaneGeometry default
    // positions). The quad spans the wash radius in world units, so
    // v_uv=±0.5 lands on the wash edge - corners reach r=0.71. We
    // normalize by 0.5 so that r=1.0 is the edge of the inscribed circle,
    // well clear of the corners — that keeps the Gaussian round, not square.
    float r = length(v_uv) / 0.5;

    // Gaussian falloff: at r=1 (edge of the inscribed circle) the wash
    // has decayed to e^-9 ≈ 0.0001, so corners are effectively zero.
    float gauss = exp(-r * r * 9.0);
    // Modulate with low-frequency fbm so the bloom isn't a perfect disk
    // — feels hand-painted. n moves in roughly [0.3, 0.9].
    float n = fbm(v_uv * 6.0 + v_radius * 17.0);
    float waterMask = gauss * mix(0.55, 1.0, n);

    // Opacity envelope — washes are most assertive at far zoom (the
    // genre-region read) and ease off as you zoom in to individual albums.
    // Range 0.55 → 0.20.
    float strength = mix(0.55, 0.20, smoothstep(0.0, 0.7, u_zoomT));
    float alpha = waterMask * strength;

    // Color is a softly tinted paper — paper * color desaturates the wash
    // toward the page tone, so it reads as ink soaking into paper rather
    // than poster paint sitting on top.
    vec3 col = paper * v_color;

    // We output a low alpha; with NormalBlending the wash overlays the
    // paper BackgroundLayer beneath it, AND overlapping washes blend
    // gently with each other rather than producing a hard boundary.
    // Because BackgroundLayer draws paper everywhere first, any leak
    // through the alpha edge reads as paper, not white.
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;
