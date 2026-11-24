import { describe, expect, it } from 'vitest';
import { makeCamera, rigFromNumbers } from './camera';
import { translate } from './mat4';
import { buildScene } from './scene';
import { captionTransform, crateIndex, projectedBox, targetQuads } from './targets';

describe('targetQuads', () => {
  const scene = buildScene({});
  const map = targetQuads(scene);

  it('has a quad for every target in the tab order', () => {
    for (const t of scene.tabOrder) {
      const id = t.kind === 'art' ? `art:${t.id}` : t.kind === 'album' ? `album:${t.slot}` : t.kind;
      expect(map.get(id), id).toBeDefined();
    }
  });

  it('stands the crate for the first crate front face and the view for its picture', () => {
    expect(map.get('crate')?.key).toBe('crate1:0');
    expect(map.get('view')?.key).toBe('pic:view');
  });
});

describe('crateIndex', () => {
  it('reads the crate of a face key and ignores everything else', () => {
    expect(crateIndex('crate1:0')).toBe(0);
    expect(crateIndex('crate2:2')).toBe(1);
    expect(crateIndex('pic:crate1:0')).toBe(-1);
  });
});

describe('captionTransform', () => {
  it('places left captions at the anchor and shifts right and bottom ones back by their size', () => {
    const m = translate(10, 20, 30);
    expect(captionTransform(m, { x: 4, y: 5, align: 'left', anchor: 'top', size: 22 })).toBe(
      'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1) translate(4px, 5px) translate(0, 0)'
    );
    expect(captionTransform(m, { x: 4, y: 5, align: 'right', anchor: 'bottom', size: 22 })).toMatch(/translate\(-100%, -100%\)$/);
  });
});

describe('projectedBox', () => {
  it('matches the projected corners of a flat quad facing the camera', () => {
    const root = { left: 0, top: 0, width: 1280, height: 900 };
    const cam = makeCamera(rigFromNumbers({ mx: 0, my: 0, amp: 0.4, tour: null, dollyZ: 0 }), 1, root);
    const box = projectedBox(cam, translate(-50, -50, 0), 100, 100);
    const [x0, y0] = cam.project([-50, -50, 0]);
    const [x1, y1] = cam.project([50, 50, 0]);
    expect(box.left).toBeCloseTo(x0, 6);
    expect(box.top).toBeCloseTo(y0, 6);
    expect(box.width).toBeCloseTo(x1 - x0, 6);
    expect(box.height).toBeCloseTo(y1 - y0, 6);
  });
});
