// Draws the room scene (scene.ts) into one WebGL canvas with three.js, painting
// each surface as a browser paints the CSS box it describes. Each quad of the scene is one mesh
// whose clip matrix (camera.clip * world) is computed here in double precision;
// three.js only manages the GL state, programs and textures.
//
// Colour: CSS blends sRGB-encoded values, so every colour stays a raw
// sRGB-encoded number: uniforms are plain numbers, textures are NoColorSpace,
// the clear colour is given as already in the working space, and the output
// is not converted. three.js's global ColorManagement is left alone (other
// three.js pages share it). Every shader
// works on premultiplied colour; transparent meshes blend with
// (ONE, ONE_MINUS_SRC_ALPHA).
//
// Rendering is on demand: render() draws one frame and says whether an
// animation (hover lift, cover fade) still needs frames; onInvalidate fires
// when something outside a render (a texture arriving) needs one.

import * as THREE from 'three';
import type { Camera } from './camera';
import { multiply, translate, type Mat4 } from './mat4';
import { gradientScale, isHardEdged, paintGradients } from './gradient-canvas';
import type { Color, Gradient, Paint, Shadow } from './paint';
import type { Quad, Scene } from './scene';

export type RoomRendererOptions = { reducedMotion?: boolean };

export type RoomRenderer = {
  setScene(scene: Scene): void;
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  render(camera: Camera, now: number): boolean;
  setHovered(key: string | null): void;
  setRing(key: string | null): void;
  setReducedMotion(reduced: boolean): void;
  quadMatrix(key: string): Mat4 | null;
  onInvalidate(cb: () => void): () => void;
  onReady(cb: () => void): () => void;
  onContextLost(cb: () => void): () => void;
  onContextRestored(cb: () => void): () => void;
  stats(): { drawCalls: number; textures: number; textureBytes: number };
  dispose(): void;
};

// #1c140e as raw 0-1 numbers.
const CLEAR: [number, number, number] = [0x1c / 255, 0x14 / 255, 0x0e / 255];
const MAX_PIXEL_RATIO = 2;
const MAX_BUFFER_PIXELS = 9.5e6;
const HOVER_S = 0.4;
// Shadows and glows sit this far (CSS px) behind their own box, in its plane:
// behind the box, in front of the surface the box hangs on (1 px or more away).
const SHADOW_Z = -0.5;
// Mipmap level bias: Chrome draws a 3D layer from a raster made at about the
// screen scale, which stays sharper than a trilinear mipmap at grazing angles.
const TILED_LOD_BIAS = 0;
const IMAGE_LOD_BIAS = -1;
const RING = { width: 3, offset: 4, color: [214, 166, 80, 1] as Color };

// --- Easing (CSS cubic-bezier).

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}
const HOVER_EASE = cubicBezier(0.2, 0.8, 0.2, 1);
const CSS_EASE = cubicBezier(0.25, 0.1, 0.25, 1);

// --- Colour helpers (premultiplied, 0-1).

type V4 = [number, number, number, number];
const pm = (c: Color): V4 => [(c[0] / 255) * c[3], (c[1] / 255) * c[3], (c[2] / 255) * c[3], c[3]];
const over = (top: V4, bottom: V4): V4 => [0, 1, 2, 3].map((i) => top[i] + bottom[i] * (1 - top[3])) as V4;
const v4 = (c: V4) => new THREE.Vector4(c[0], c[1], c[2], c[3]);
const ZERO: V4 = [0, 0, 0, 0];
// THREE.Vector4() starts at (0, 0, 0, 1); every vec4 uniform starts at zero
// instead, so an unset border width or colour draws nothing.
const zero4 = () => new THREE.Vector4(0, 0, 0, 0);

// --- Shaders.

const VERT = /* glsl */ `
uniform mat4 uMVP;
uniform vec4 uRect;
varying vec2 vP;
void main() {
  vP = mix(uRect.xy, uRect.zw, position.xy);
  gl_Position = uMVP * vec4(vP, 0.0, 1.0);
}`;

// One shader for every painted box: background (solid, tiled texture with
// tint, overlays and gradient layers, gradient, image, picture), inset band,
// border with per-side colours meeting at mitred corners, corner radius and
// outline. vP is the fragment's position in the box's CSS px.
const SURFACE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec2 uSize;
uniform vec4 uBW;
uniform vec4 uBC[4];
uniform float uRadius;
uniform int uFill;
uniform vec4 uColor;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexSize;
uniform vec2 uTexPos;
uniform vec3 uTint;
uniform vec4 uOverlay;
uniform sampler2D uGrad;
uniform float uHasGrad;
uniform vec4 uImg;
uniform float uImgAlpha;
uniform vec4 uSleeve;
uniform vec4 uSleeveColor;
uniform vec2 uFilter;
uniform vec4 uInsetC;
uniform float uInsetW;
uniform vec4 uOutlineC;
uniform vec2 uOutline;
uniform float uOpaque;
uniform float uBias;

// Antialiased coverage of the rectangle r = (x0, y0, x1, y1).
float cov(vec2 p, vec4 r) {
  vec2 fw = max(fwidth(p), vec2(1e-4));
  vec2 a = clamp((p - r.xy) / fw + 0.5, 0.0, 1.0) * clamp((r.zw - p) / fw + 0.5, 0.0, 1.0);
  return a.x * a.y;
}
vec4 over(vec4 top, vec4 bottom) { return top + bottom * (1.0 - top.a); }
// CSS brightness() then saturate(), on sRGB values as Chrome applies them.
vec3 filt(vec3 c) {
  c = clamp(c * uFilter.x, 0.0, 1.0);
  float s = uFilter.y;
  vec3 o = vec3(
    (0.213 + 0.787 * s) * c.r + (0.715 - 0.715 * s) * c.g + (0.072 - 0.072 * s) * c.b,
    (0.213 - 0.213 * s) * c.r + (0.715 + 0.285 * s) * c.g + (0.072 - 0.072 * s) * c.b,
    (0.213 - 0.213 * s) * c.r + (0.715 - 0.715 * s) * c.g + (0.072 + 0.928 * s) * c.b);
  return clamp(o, 0.0, 1.0);
}
vec4 sampleImage(vec2 uv) {
  vec4 t = texture2D(uTex, uv, uBias);
  vec3 c = t.a > 0.0 ? t.rgb / t.a : vec3(0.0);
  return vec4(filt(c) * t.a, t.a);
}

void main() {
  vec2 p = vP;
  vec4 pb = vec4(uBW.w, uBW.x, uSize.x - uBW.y, uSize.y - uBW.z);
  vec2 pp = p - pb.xy;
  vec2 ps = max(pb.zw - pb.xy, vec2(1e-3));
  vec4 col = vec4(0.0);
  if (uFill == 1) {
    col = uColor;
  } else if (uFill == 2) {
    vec4 base = uColor;
    if (uHasTex > 0.5) base = vec4(texture2D(uTex, (pp - uTexPos) / uTexSize, uBias).rgb * uTint, 1.0);
    base = over(uOverlay, base);
    if (uHasGrad > 0.5) base = over(texture2D(uGrad, pp / ps), base);
    col = base;
  } else if (uFill == 3) {
    if (uHasGrad > 0.5) col = texture2D(uGrad, clamp(pp / ps, 0.0, 1.0));
  } else if (uFill == 4) {
    if (uHasTex > 0.5) col = sampleImage(p / uSize);
  } else if (uFill == 5) {
    col = uColor;
    if (uSleeveColor.a > 0.0) col = over(uSleeveColor * cov(p, vec4(uSleeve.xy, uSleeve.xy + uSleeve.zw)), col);
    if (uHasTex > 0.5 && uImgAlpha > 0.0) {
      vec4 t = sampleImage((p - uImg.xy) / uImg.zw);
      col = over(t * (uImgAlpha * cov(p, vec4(uImg.xy, uImg.xy + uImg.zw))), col);
    }
  }
  if (uInsetW > 0.0) {
    float band = cov(p, pb) - cov(p, pb + vec4(uInsetW, uInsetW, -uInsetW, -uInsetW));
    col = over(uInsetC * band, col);
  }
  if (uBW.x + uBW.y + uBW.z + uBW.w > 0.0) {
    float band = 1.0 - cov(p, pb);
    float dt = uBW.x > 0.0 ? p.y / uBW.x : 1e9;
    float dr = uBW.y > 0.0 ? (uSize.x - p.x) / uBW.y : 1e9;
    float db = uBW.z > 0.0 ? (uSize.y - p.y) / uBW.z : 1e9;
    float dl = uBW.w > 0.0 ? p.x / uBW.w : 1e9;
    vec4 bc = uBC[0];
    float m = dt;
    if (dr < m) { m = dr; bc = uBC[1]; }
    if (db < m) { m = db; bc = uBC[2]; }
    if (dl < m) { bc = uBC[3]; }
    col = over(bc * band, col);
  }
  if (uRadius > 0.0) {
    vec2 c = uSize * 0.5;
    vec2 q = abs(p - c) - (c - uRadius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    col *= clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);
  }
  if (uOutline.x > 0.0) {
    float o1 = uOutline.y + uOutline.x;
    float o0 = uOutline.y;
    float band = cov(p, vec4(-o1, -o1, uSize + o1)) - cov(p, vec4(-o0, -o0, uSize + o0));
    col = over(uOutlineC * band, col);
  }
  if (uOpaque > 0.5) {
    if (col.a < 0.5) discard;
    gl_FragColor = vec4(col.rgb / col.a, 1.0);
  } else {
    gl_FragColor = col;
  }
}`;

// Gaussian-blurred rectangles (box-shadows, the light shafts' filter: blur,
// the lamp glow): the exact blur of a rectangle is a product of two erf terms;
// disjoint rectangles of one colour sum.
const SOFT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec4 uR[4];
uniform int uN;
uniform float uSigma;
uniform vec4 uColor;
float erf1(float x) {
  float s = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * x);
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return s * y;
}
float blurBox(vec2 p, vec4 r, float s) {
  float k = 0.70710678 / s;
  float ax = 0.5 * (erf1((p.x - r.x) * k) - erf1((p.x - r.z) * k));
  float ay = 0.5 * (erf1((p.y - r.y) * k) - erf1((p.y - r.w) * k));
  return ax * ay;
}
void main() {
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uN) break;
    a += blurBox(vP, uR[i], uSigma);
  }
  gl_FragColor = uColor * min(a, 1.0);
}`;

const FILL_CODE = { none: 0, solid: 1, tiled: 2, gradient: 3, image: 4, picture: 5 } as const;

// --- Scene items: one mesh each.

type Item = {
  quad: Quad;
  mesh: THREE.Mesh;
  u: Record<string, THREE.IUniform>;
  z: number;
  // Transparent items: paint order (DOM order of the owning box, then shadows first).
  order: number;
  transparent: boolean;
  // Texture URL this item waits for (tiled texture, image, picture).
  src: string | null;
  // Gradient canvas texture key, if any.
  grad: string | null;
  // Album covers fade in once loaded.
  fade: number;
};

type TexEntry = { tex: THREE.Texture | null; state: 'loading' | 'ok' | 'error'; bytes: number; fadeStart: number | null | undefined };

type HoverAnim = { from: Mat4; to: 'rest' | 'hover'; start: number | null };

function gradientsOf(paint: Paint): Gradient[] {
  const f = paint.fill;
  if (f.kind === 'gradient') return f.layers;
  if (f.kind === 'tiled') return f.gradients;
  return [];
}

function lerpMat(a: Mat4, b: Mat4, t: number): Mat4 {
  return a.map((x, i) => x + (b[i] - x) * t);
}

export function createRoomRenderer(canvas: HTMLCanvasElement, options: RoomRendererOptions = {}): RoomRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color().setRGB(CLEAR[0], CLEAR[1], CLEAR[2], THREE.LinearSRGBColorSpace), 1);
  renderer.sortObjects = true;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  let reducedMotion = !!options.reducedMotion;
  const scene3 = new THREE.Scene();
  const cam3 = new THREE.Camera();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);

  const listeners = { invalidate: new Set<() => void>(), ready: new Set<() => void>(), lost: new Set<() => void>(), restored: new Set<() => void>() };
  const emit = (set: Set<() => void>) => set.forEach((cb) => cb());
  const sub = (set: Set<() => void>, cb: () => void) => {
    set.add(cb);
    return () => set.delete(cb);
  };

  const textures = new Map<string, TexEntry>();
  const gradients = new Map<string, { tex: THREE.CanvasTexture; bytes: number }>();
  let items: Item[] = [];
  let ring: Item | null = null;
  let quads = new Map<string, Quad>();
  const hover = new Map<string, HoverAnim>();
  const current = new Map<string, Mat4>();
  let hovered: string | null = null;
  let ringKey: string | null = null;
  let readyPending = false;
  let disposed = false;

  // --- Textures.

  function loadTexture(url: string, kind: 'tiled' | 'image'): TexEntry {
    const have = textures.get(url);
    if (have) return have;
    const entry: TexEntry = { tex: null, state: 'loading', bytes: 0, fadeStart: undefined };
    textures.set(url, entry);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img
      .decode()
      .then(() => {
        if (disposed || textures.get(url) !== entry) return;
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.NoColorSpace;
        t.flipY = false;
        t.premultiplyAlpha = true;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = maxAniso;
        t.wrapS = t.wrapT = kind === 'tiled' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        entry.tex = t;
        entry.state = 'ok';
        entry.bytes = Math.round(img.naturalWidth * img.naturalHeight * 4 * (4 / 3));
        entry.fadeStart = null;
        bindTextures();
        emit(listeners.invalidate);
      })
      .catch(() => {
        if (textures.get(url) !== entry) return;
        entry.state = 'error';
        emit(listeners.invalidate);
      });
    return entry;
  }

  function gradientTexture(layers: Gradient[], w: number, h: number): string {
    const scale = gradientScale(layers, w, h);
    const key = `${JSON.stringify(layers)}|${w}x${h}|${scale}`;
    if (!gradients.has(key)) {
      const c = paintGradients(layers, w, h, scale);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      t.premultiplyAlpha = true;
      // Hard-edged layers (stripes, straps) keep their colours at grazing
      // angles, as CSS paints them: no mipmaps, so they are not averaged away.
      const hard = isHardEdged(layers);
      t.generateMipmaps = !hard;
      t.minFilter = hard ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = maxAniso;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      gradients.set(key, { tex: t, bytes: Math.round(c.width * c.height * 4 * (4 / 3)) });
    }
    return key;
  }

  // Points every item at its texture once loaded.
  function bindTextures() {
    for (const it of [...items, ...(ring ? [ring] : [])]) {
      if (!it.src) continue;
      const e = textures.get(it.src);
      const ok = !!e && e.state === 'ok' && !!e.tex;
      it.u.uTex.value = ok ? e.tex : null;
      it.u.uHasTex.value = ok ? 1 : 0;
    }
  }

  // --- Building meshes.

  function surfaceUniforms(): Record<string, THREE.IUniform> {
    return {
      uMVP: { value: new THREE.Matrix4() },
      uRect: { value: zero4() },
      uSize: { value: new THREE.Vector2() },
      uBW: { value: zero4() },
      uBC: { value: [0, 1, 2, 3].map(zero4) },
      uRadius: { value: 0 },
      uFill: { value: 0 },
      uColor: { value: zero4() },
      uTex: { value: null },
      uHasTex: { value: 0 },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uTexPos: { value: new THREE.Vector2() },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uOverlay: { value: zero4() },
      uGrad: { value: null },
      uHasGrad: { value: 0 },
      uImg: { value: new THREE.Vector4(0, 0, 1, 1) },
      uImgAlpha: { value: 1 },
      uSleeve: { value: zero4() },
      uSleeveColor: { value: zero4() },
      uFilter: { value: new THREE.Vector2(1, 1) },
      uInsetC: { value: zero4() },
      uInsetW: { value: 0 },
      uOutlineC: { value: zero4() },
      uOutline: { value: new THREE.Vector2() },
      uOpaque: { value: 0 },
      uBias: { value: 0 },
    };
  }

  function makeMesh(frag: string, u: Record<string, THREE.IUniform>, transparent: boolean): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: frag,
      uniforms: u,
      side: THREE.DoubleSide,
      transparent,
      depthTest: true,
      depthWrite: !transparent,
      blending: transparent ? THREE.CustomBlending : THREE.NoBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  function surfaceItem(q: Quad, paint: Paint): Item | null {
    const f = paint.fill;
    const inset = (paint.shadows ?? []).filter((s) => s.inset);
    const hasBorder = !!paint.border && paint.border.width.some((x) => x > 0);
    if (f.kind === 'none' && !hasBorder && inset.length === 0 && !paint.outline) return null;
    const u = surfaceUniforms();
    u.uRect.value.set(0, 0, q.w, q.h);
    u.uSize.value.set(q.w, q.h);
    if (paint.border) {
      const [t, r, b, l] = paint.border.width;
      u.uBW.value.set(t, r, b, l);
      paint.border.color.forEach((c, i) => (u.uBC.value as THREE.Vector4[])[i].copy(v4(pm(c))));
    }
    const bw = paint.border?.width ?? [0, 0, 0, 0];
    const padW = q.w - bw[1] - bw[3];
    const padH = q.h - bw[0] - bw[2];
    u.uFill.value = FILL_CODE[f.kind as keyof typeof FILL_CODE] ?? 0;
    let opaque = false;
    let src: string | null = null;
    let grad: string | null = null;
    let fade = 0;
    if (f.kind === 'solid') {
      u.uColor.value.copy(v4(pm(f.color)));
      opaque = f.color[3] >= 1 && !paint.radius;
    } else if (f.kind === 'tiled') {
      u.uColor.value.copy(v4(pm(f.fallback)));
      u.uTexSize.value.set(f.size[0], f.size[1]);
      u.uTexPos.value.set(f.position[0], f.position[1]);
      if (f.tint) u.uTint.value.set(f.tint[0] / 255, f.tint[1] / 255, f.tint[2] / 255);
      u.uOverlay.value.copy(v4(f.overlays.reduceRight<V4>((acc, c) => over(pm(c), acc), ZERO)));
      src = f.texture;
      loadTexture(src, 'tiled');
      u.uBias.value = TILED_LOD_BIAS;
      opaque = !paint.radius;
    } else if (f.kind === 'gradient') {
      opaque = !paint.radius && f.layers.some((g) => g.stops.every((s) => s.color[3] >= 1));
    } else if (f.kind === 'image') {
      src = f.src;
      loadTexture(src, 'image');
      u.uBias.value = IMAGE_LOD_BIAS;
      if (f.filter) u.uFilter.value.set(f.filter.brightness, f.filter.saturate);
    } else if (f.kind === 'picture') {
      if (f.mat) u.uColor.value.copy(v4(pm(f.mat)));
      const [x, y, w, h] = f.image;
      u.uImg.value.set(x, y, w, h);
      if (f.sleeve) {
        const [sx, sy, sw, sh] = f.sleeve.rect;
        u.uSleeve.value.set(sx, sy, sw, sh);
        u.uSleeveColor.value.copy(v4(pm(f.sleeve.color)));
        fade = f.sleeve.fadeIn;
      }
      if (f.filter) u.uFilter.value.set(f.filter.brightness, f.filter.saturate);
      src = f.source.src;
      if (src) loadTexture(src, 'image');
      u.uBias.value = IMAGE_LOD_BIAS;
      opaque = true;
    }
    const layers = gradientsOf(paint);
    if (layers.length) {
      grad = gradientTexture(layers, padW, padH);
      u.uGrad.value = gradients.get(grad)!.tex;
      u.uHasGrad.value = 1;
    }
    if (inset.length) {
      // Only zero-blur, zero-offset inset shadows occur: flat inner bands.
      const s = inset[0];
      u.uInsetW.value = s.spread;
      u.uInsetC.value.copy(v4(pm(s.color)));
    }
    if (paint.outline) {
      u.uOutline.value.set(paint.outline.width, paint.outline.offset);
      u.uOutlineC.value.copy(v4(pm(paint.outline.color)));
    }
    if (paint.radius && f.kind !== 'picture') u.uRadius.value = paint.radius;
    u.uOpaque.value = opaque ? 1 : 0;
    const mesh = makeMesh(SURFACE_FRAG, u, !opaque);
    return { quad: q, mesh, u, z: 0, order: q.rank, transparent: !opaque, src, grad, fade };
  }

  function softItem(q: Quad, rects: [number, number, number, number][], sigma: number, color: Color, z: number, order: number): Item {
    const s = Math.max(sigma, 0.25);
    const g = 3 * s + 1;
    const x0 = Math.min(...rects.map((r) => r[0])) - g;
    const y0 = Math.min(...rects.map((r) => r[1])) - g;
    const x1 = Math.max(...rects.map((r) => r[2])) + g;
    const y1 = Math.max(...rects.map((r) => r[3])) + g;
    const u: Record<string, THREE.IUniform> = {
      uMVP: { value: new THREE.Matrix4() },
      uRect: { value: new THREE.Vector4(x0, y0, x1, y1) },
      uR: { value: [0, 1, 2, 3].map((i) => (rects[i] ? new THREE.Vector4(...rects[i]) : zero4())) },
      uN: { value: Math.min(4, rects.length) },
      uSigma: { value: s },
      uColor: { value: v4(pm(color)) },
    };
    return { quad: q, mesh: makeMesh(SOFT_FRAG, u, true), u, z, order, transparent: true, src: null, grad: null, fade: 0 };
  }

  function shadowItems(q: Quad, shadows: Shadow[]): Item[] {
    // CSS draws the first shadow on top: emit the last first.
    return shadows
      .filter((s) => !s.inset)
      .reverse()
      .map((s, i, all) => {
        const r: [number, number, number, number] = [s.x - s.spread, s.y - s.spread, q.w + s.x + s.spread, q.h + s.y + s.spread];
        return softItem(q, [r], s.blur / 2, s.color, SHADOW_Z, q.rank - 0.5 + i / (all.length + 1) / 2);
      });
  }

  function clearItems() {
    for (const it of items) {
      scene3.remove(it.mesh);
      (it.mesh.material as THREE.Material).dispose();
    }
    items = [];
    if (ring) {
      scene3.remove(ring.mesh);
      (ring.mesh.material as THREE.Material).dispose();
      ring = null;
    }
  }

  function setScene(scene: Scene) {
    clearItems();
    quads = new Map();
    const next: Item[] = [];
    for (const q of scene.quads) {
      if (q.layer === 'dom' || q.paint.fill.kind === 'dom') continue;
      quads.set(q.key, q);
      const paint = q.paint;
      if (paint.shadows) next.push(...shadowItems(q, paint.shadows));
      if (paint.fill.kind === 'rects') {
        const rects = paint.fill.rects.map(([x, y, w, h]) => [x, y, x + w, y + h] as [number, number, number, number]);
        next.push(softItem(q, rects, paint.blur ?? 0, paint.fill.color, 0, q.rank));
        continue;
      }
      const s = surfaceItem(q, paint);
      if (s) next.push(s);
    }
    items = next;
    // Transparent items in paint order; opaque ones need none (depth decides).
    const trans = items.filter((i) => i.transparent).sort((a, b) => a.order - b.order);
    trans.forEach((it, i) => (it.mesh.renderOrder = i + 1));
    for (const it of items) scene3.add(it.mesh);

    // The focus ring: an outline-only box that follows the ringed picture.
    const ru = surfaceUniforms();
    ru.uOutline.value.set(RING.width, RING.offset);
    ru.uOutlineC.value.copy(v4(pm(RING.color)));
    ring = { quad: scene.quads[0], mesh: makeMesh(SURFACE_FRAG, ru, true), u: ru, z: 0, order: Infinity, transparent: true, src: null, grad: null, fade: 0 };
    ring.mesh.renderOrder = trans.length + 1;
    ring.mesh.visible = false;
    scene3.add(ring.mesh);

    // Drop textures this scene no longer uses.
    const used = new Set(items.map((i) => i.src).filter(Boolean));
    for (const [url, e] of textures) {
      if (!used.has(url)) {
        e.tex?.dispose();
        textures.delete(url);
      }
    }
    const usedGrad = new Set(items.map((i) => i.grad).filter(Boolean));
    for (const [k, g] of gradients) {
      if (!usedGrad.has(k)) {
        g.tex.dispose();
        gradients.delete(k);
      }
    }
    for (const k of [...hover.keys()]) if (!quads.has(k)) hover.delete(k);
    bindTextures();
    readyPending = true;
    emit(listeners.invalidate);
  }

  // --- Animation state.

  function restMatrix(q: Quad, which: 'rest' | 'hover'): Mat4 {
    return which === 'hover' && q.picture ? q.picture.hoverMatrix : q.matrix;
  }

  function matrixAt(key: string, now: number): { m: Mat4; moving: boolean } {
    const q = quads.get(key);
    if (!q) return { m: [], moving: false };
    const a = hover.get(key);
    if (!a) return { m: q.matrix, moving: false };
    const to = restMatrix(q, a.to);
    if (a.start === null) a.start = now;
    const dur = reducedMotion ? 0 : HOVER_S * 1000;
    const t = dur > 0 ? Math.min(1, (now - a.start) / dur) : 1;
    if (t >= 1) {
      if (a.to === 'rest') hover.delete(key);
      return { m: to, moving: false };
    }
    return { m: lerpMat(a.from, to, HOVER_EASE(t)), moving: true };
  }

  function setHovered(key: string | null) {
    if (key === hovered) return;
    const change = (k: string, to: 'rest' | 'hover') => {
      const q = quads.get(k);
      if (!q?.picture) return;
      hover.set(k, { from: current.get(k) ?? q.matrix, to, start: null });
    };
    if (hovered) change(hovered, 'rest');
    hovered = key;
    if (key) change(key, 'hover');
    emit(listeners.invalidate);
  }

  function setRing(key: string | null) {
    ringKey = key;
    emit(listeners.invalidate);
  }

  function allSettled(): boolean {
    for (const it of items) {
      if (!it.src) continue;
      const e = textures.get(it.src);
      if (!e || e.state === 'loading') return false;
    }
    return true;
  }

  function render(camera: Camera, now: number): boolean {
    if (disposed || renderer.getContext().isContextLost()) return false;
    let animating = false;
    current.clear();
    for (const key of hover.keys()) {
      const { m, moving } = matrixAt(key, now);
      current.set(key, m);
      animating ||= moving;
    }
    const clip = camera.clip;
    const place = (it: Item, world: Mat4) => {
      const w = it.z ? multiply(world, translate(0, 0, it.z)) : world;
      (it.u.uMVP.value as THREE.Matrix4).fromArray(multiply(clip, w));
    };
    for (const it of items) {
      place(it, current.get(it.quad.key) ?? it.quad.matrix);
      if (it.fade > 0 && it.src) {
        const e = textures.get(it.src);
        if (e?.state === 'ok') {
          if (e.fadeStart === null || e.fadeStart === undefined) e.fadeStart = now;
          const dur = reducedMotion ? 0 : it.fade * 1000;
          const t = dur > 0 ? Math.min(1, (now - e.fadeStart) / dur) : 1;
          it.u.uImgAlpha.value = CSS_EASE(t);
          animating ||= t < 1;
        } else it.u.uImgAlpha.value = 0;
      }
    }
    if (ring) {
      const q = ringKey ? quads.get(ringKey) : undefined;
      ring.mesh.visible = !!q;
      if (q) {
        const g = RING.offset + RING.width + 1;
        ring.u.uRect.value.set(-g, -g, q.w + g, q.h + g);
        ring.u.uSize.value.set(q.w, q.h);
        ring.quad = q;
        place(ring, current.get(q.key) ?? q.matrix);
      }
    }
    renderer.render(scene3, cam3);
    if (readyPending && allSettled()) {
      readyPending = false;
      emit(listeners.ready);
    }
    return animating;
  }

  function resize(cssWidth: number, cssHeight: number, dpr: number) {
    let pr = Math.min(dpr || 1, MAX_PIXEL_RATIO);
    if (cssWidth * cssHeight * pr * pr > MAX_BUFFER_PIXELS) pr = Math.sqrt(MAX_BUFFER_PIXELS / (cssWidth * cssHeight));
    renderer.setPixelRatio(pr);
    renderer.setSize(Math.max(1, Math.round(cssWidth)), Math.max(1, Math.round(cssHeight)), false);
    emit(listeners.invalidate);
  }

  const onLost = () => emit(listeners.lost);
  const onRestored = () => {
    bindTextures();
    emit(listeners.restored);
    emit(listeners.invalidate);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    setScene,
    resize,
    render,
    setHovered,
    setRing,
    setReducedMotion: (r) => {
      reducedMotion = r;
    },
    quadMatrix: (key) => current.get(key) ?? quads.get(key)?.matrix ?? null,
    onInvalidate: (cb) => sub(listeners.invalidate, cb),
    onReady: (cb) => sub(listeners.ready, cb),
    onContextLost: (cb) => sub(listeners.lost, cb),
    onContextRestored: (cb) => sub(listeners.restored, cb),
    stats: () => {
      let bytes = 0;
      for (const e of textures.values()) bytes += e.bytes;
      for (const g of gradients.values()) bytes += g.bytes;
      return { drawCalls: renderer.info.render.calls, textures: textures.size + gradients.size, textureBytes: bytes };
    },
    dispose: () => {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      clearItems();
      for (const e of textures.values()) e.tex?.dispose();
      for (const g of gradients.values()) g.tex.dispose();
      textures.clear();
      gradients.clear();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
