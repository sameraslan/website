// The room's camera as CSS builds it: a 1280 x 900 stage centred in the root,
// scaled by --rs-scale about its centre, `perspective: 900px` with
// `perspective-origin: 640px 500px`, and the rig dolly > sway > cam whose
// origin sits at stage (640, 500). Pure: no DOM, no three.js.

import { apply, compose, multiply, parseMatrix, rotateX, rotateY, translate, type Mat4, type Vec3 } from './mat4';

export const PERSPECTIVE = 900;
export const STAGE = { w: 1280, h: 900 };
export const RIG_ORIGIN = { x: 640, y: 500 };
export const NEAR = 200;
export const FAR = 4000;

export type Rig = { dolly: Mat4; sway: Mat4; cam: Mat4 };
export type RootRect = { left: number; top: number; width: number; height: number };

export type Camera = {
  // Room point to rig space (q): Dolly * Sway * Cam.
  view: Mat4;
  scale: number;
  root: RootRect;
  // Room point to viewport px, exactly as the CSS projects it.
  project: (p: Vec3) => [number, number];
  // Room point to WebGL clip space (x, y in [-1, 1] over the root with y up;
  // depth from the view distance d = 900 - q.z, near 200, far 4000).
  clip: Mat4;
};

// From the three computed `transform` strings (none / matrix / matrix3d).
export const rigFromCss = (t: { dolly: string; sway: string; cam: string }): Rig => ({
  dolly: parseMatrix(t.dolly),
  sway: parseMatrix(t.sway),
  cam: parseMatrix(t.cam),
});

// From numbers, following room.css: the parallax on .rs-cam (--mx, --my in
// [-1, 1], --amp 0.4 reading or 1 exploring), the tour on .rs-sway (rotateY in
// deg and translate3d in px; null outside explore mode) and the load-in dolly
// (translateZ in px, 0 once settled).
export function rigFromNumbers(n: { mx: number; my: number; amp: number; tour: { r: number; x: number; y: number; z: number } | null; dollyZ: number }): Rig {
  const { mx, my, amp } = n;
  const cam = compose(
    translate(0, 0, 900),
    rotateX(my * amp * -2.5),
    rotateY(mx * amp * 8),
    translate(0, 0, -900),
    translate(mx * amp * -60, my * amp * -20, 0)
  );
  const t = n.tour;
  const sway = t ? compose(translate(0, 0, 900), rotateY(t.r), translate(0, 0, -900), translate(t.x, t.y, t.z)) : compose();
  return { dolly: translate(0, 0, n.dollyZ), sway, cam };
}

// Rig space (q, homogeneous) to clip space, for a root of `root` size.
function clipFromRig(scale: number, root: RootRect): Mat4 {
  const { width: W, height: H } = root;
  const P = PERSPECTIVE;
  const s = scale;
  const A = (FAR + NEAR) / (FAR - NEAR);
  const B = (-2 * FAR * NEAR) / (FAR - NEAR);
  // Row-major rows of K; clip = K * q with clip.w = d = P * q.w - q.z.
  // ndc x = 2 s P q.x / (W d); ndc y = -2 s (P q.y + (RIG_ORIGIN.y - STAGE.h / 2) d) / (H d).
  const oy = RIG_ORIGIN.y - STAGE.h / 2;
  const rows = [
    [(2 * s * P) / W, 0, 0, 0],
    [0, (-2 * s * P) / H, (2 * s * oy) / H, (-2 * s * oy * P) / H],
    [0, 0, -A, P * A + B],
    [0, 0, -1, P],
  ];
  const m = new Array<number>(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) m[c * 4 + r] = rows[r][c];
  return m;
}

export function makeCamera(rig: Rig, scale: number, root: RootRect): Camera {
  const view = multiply(multiply(rig.dolly, rig.sway), rig.cam);
  const project = (p: Vec3): [number, number] => {
    const [x, y, z, w] = apply(view, p);
    const k = w - z / PERSPECTIVE;
    const sx = RIG_ORIGIN.x + x / k;
    const sy = RIG_ORIGIN.y + y / k;
    return [root.left + root.width / 2 + scale * (sx - STAGE.w / 2), root.top + root.height / 2 + scale * (sy - STAGE.h / 2)];
  };
  return { view, scale, root, project, clip: multiply(clipFromRig(scale, root), view) };
}

// Clip space to viewport px (for checks; a renderer lets the GPU do this).
export function clipToViewport(clip: [number, number, number, number], root: RootRect): [number, number] {
  const [x, y, , w] = clip;
  return [root.left + ((x / w + 1) / 2) * root.width, root.top + ((1 - y / w) / 2) * root.height];
}
