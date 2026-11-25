// 4x4 matrices as CSS uses them: column-major (the order of matrix3d()), y
// down, angles in degrees with CSS's sign conventions. A transform list
// "f1 f2 f3" composes as M = f1 * f2 * f3, applied to column vectors.
// No DOM, no three.js.

export type Mat4 = number[]; // 16 numbers, column-major
export type Vec3 = [number, number, number];

export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const o = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export const compose = (...ms: Mat4[]): Mat4 => ms.reduce((acc, m) => multiply(acc, m), identity());

export const translate = (x: number, y: number, z = 0): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
export const scale = (x: number, y = x, z = 1): Mat4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

const rad = (deg: number) => (deg * Math.PI) / 180;

export function rotateX(deg: number): Mat4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

export function rotateY(deg: number): Mat4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

export function rotateZ(deg: number): Mat4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// skewX(a): x' = x + tan(a) y. skewY(a): y' = y + tan(a) x.
export const skewX = (deg: number): Mat4 => [1, 0, 0, 0, Math.tan(rad(deg)), 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const skewY = (deg: number): Mat4 => [1, Math.tan(rad(deg)), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function invert(m: Mat4): Mat4 {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) throw new Error('Singular matrix');
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

// m * (x, y, z, 1): the homogeneous result.
export function apply(m: Mat4, p: Vec3): [number, number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

// m * p with the perspective divide.
export function projectPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z, w] = apply(m, p);
  return [x / w, y / w, z / w];
}

// A computed `transform` value: none, matrix(a, b, c, d, e, f) or matrix3d(16).
export function parseMatrix(s: string): Mat4 {
  const t = s.trim();
  if (t === 'none' || t === '') return identity();
  const m = /^(matrix3d|matrix)\(([^)]*)\)$/.exec(t);
  if (!m) throw new Error(`Not a computed transform: ${s}`);
  const n = m[2].split(',').map(Number);
  if (m[1] === 'matrix3d') {
    if (n.length !== 16) throw new Error(`matrix3d needs 16 numbers: ${s}`);
    return n;
  }
  const [a, b, c, d, e, f] = n;
  return [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, e, f, 0, 1];
}

// A length in px or a percentage of `ref` px.
function len(v: string, ref: number): number {
  const s = v.trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * ref;
  if (s.endsWith('px')) return parseFloat(s);
  if (s === '0') return 0;
  throw new Error(`Unsupported length: ${v}`);
}

function angle(v: string): number {
  const s = v.trim();
  if (s.endsWith('deg')) return parseFloat(s);
  if (s === '0') return 0;
  throw new Error(`Unsupported angle: ${v}`);
}

// A specified transform list (the subset the room uses), percentages against
// the element's border box w x h.
export function parseTransform(s: string | undefined, w = 0, h = 0): Mat4 {
  if (!s || s.trim() === 'none') return identity();
  const out: Mat4[] = [];
  const re = /([a-zA-Z0-9]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const fn = m[1];
    const args = m[2].split(',').map((a) => a.trim());
    switch (fn) {
      case 'translate3d':
        out.push(translate(len(args[0], w), len(args[1], h), len(args[2], 0)));
        break;
      case 'translate':
        out.push(translate(len(args[0], w), args[1] ? len(args[1], h) : 0));
        break;
      case 'translateX':
        out.push(translate(len(args[0], w), 0));
        break;
      case 'translateY':
        out.push(translate(0, len(args[0], h)));
        break;
      case 'translateZ':
        out.push(translate(0, 0, len(args[0], 0)));
        break;
      case 'rotateX':
        out.push(rotateX(angle(args[0])));
        break;
      case 'rotateY':
        out.push(rotateY(angle(args[0])));
        break;
      case 'rotate':
      case 'rotateZ':
        out.push(rotateZ(angle(args[0])));
        break;
      case 'skewX':
        out.push(skewX(angle(args[0])));
        break;
      case 'skewY':
        out.push(skewY(angle(args[0])));
        break;
      case 'scale':
        out.push(scale(Number(args[0]), args[1] ? Number(args[1]) : Number(args[0])));
        break;
      case 'scaleX':
        out.push(scale(Number(args[0]), 1));
        break;
      case 'scaleY':
        out.push(scale(1, Number(args[0])));
        break;
      default:
        throw new Error(`Unsupported transform function: ${fn}`);
    }
  }
  return compose(...out);
}

// A transform-origin ("50% 100%", "0 0"; default centre) in px of a w x h box.
export function parseOrigin(s: string | undefined, w: number, h: number): [number, number] {
  if (!s) return [w / 2, h / 2];
  const [x, y = '50%'] = s.trim().split(/\s+/);
  return [len(x, w), len(y, h)];
}

// The local matrix of a CSS box: placed at (x, y) in its containing block,
// transformed about its origin.
export function boxMatrix(x: number, y: number, w: number, h: number, transform?: string, origin?: string): Mat4 {
  const t = parseTransform(transform, w, h);
  const [ox, oy] = parseOrigin(origin, w, h);
  return compose(translate(x + ox, y + oy), t, translate(-ox, -oy));
}
