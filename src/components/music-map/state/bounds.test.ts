import { describe, expect, it } from "vitest";

import { nudgeVector, viewportWorldRect } from "./bounds";

describe("viewportWorldRect", () => {
  it("computes half-width/half-height in world units from the camera's frustum and zoom", () => {
    const cam = { left: -0.75, right: 0.75, top: 0.55, bottom: -0.55, zoom: 2.4 };
    const vp = viewportWorldRect(cam);
    expect(vp.halfW).toBeCloseTo(1.5 / 2.4 / 2, 10);
    expect(vp.halfH).toBeCloseTo(1.1 / 2.4 / 2, 10);
  });

  it("shrinks as zoom increases", () => {
    const base = { left: -0.75, right: 0.75, top: 0.55, bottom: -0.55, zoom: 1 };
    const zoomedIn = { ...base, zoom: 4 };
    const vpBase = viewportWorldRect(base);
    const vpZoomed = viewportWorldRect(zoomedIn);
    expect(vpZoomed.halfW).toBeLessThan(vpBase.halfW);
    expect(vpZoomed.halfH).toBeLessThan(vpBase.halfH);
  });
});

describe("nudgeVector", () => {
  const cloud = { minX: -0.4, maxX: 0.4, minY: -0.3, maxY: 0.3 };

  it("returns null when the cloud is already mostly visible (centered, zoomed to fit)", () => {
    const viewport = { halfW: 0.5, halfH: 0.4 };
    const camPos = { x: 0, y: 0 };
    expect(nudgeVector(camPos, viewport, cloud, 0.04)).toBeNull();
  });

  it("returns null for a small pan that still keeps most of the cloud in view", () => {
    // Viewport half-width 0.5 centered at x=0.3: view spans [-0.2, 0.8].
    // Cloud spans [-0.4, 0.4] (width 0.8); overlap is [-0.2, 0.4] = 0.6 wide,
    // 75% of the cloud's width, well above the 25% threshold.
    const viewport = { halfW: 0.5, halfH: 0.4 };
    const camPos = { x: 0.3, y: 0 };
    expect(nudgeVector(camPos, viewport, cloud, 0.04)).toBeNull();
  });

  it("returns null when zoomed out far enough that the cloud fits entirely inside the viewport", () => {
    // Old bug: a viewport bigger than the cloud used to force-recenter every
    // time. Zooming out to see everything must not be yanked back.
    const viewport = { halfW: 5, halfH: 5 };
    const camPos = { x: 0.35, y: -0.2 };
    expect(nudgeVector(camPos, viewport, cloud, 0.04)).toBeNull();
  });

  it("returns a correcting delta when the cloud is mostly out of view", () => {
    // Viewport half-width 0.1 (narrow) centered far to the right of the
    // cloud: essentially none of the cloud is visible.
    const viewport = { halfW: 0.1, halfH: 0.1 };
    const camPos = { x: 2, y: 0 };
    const delta = nudgeVector(camPos, viewport, cloud, 0.04);
    expect(delta).not.toBeNull();
    // Correction should pull the camera back toward the cloud (negative x).
    expect(delta!.x).toBeLessThan(0);
  });

  it("does not nudge while the correction would already sit within the eased margin", () => {
    // Camera already exactly at the clamp target: zero-length delta reads as
    // "no correction needed" (null), not a zero-vector nudge that would keep
    // frameloop='demand' rendering forever.
    const viewport = { halfW: 0.1, halfH: 0.1 };
    // loX = cloud.minX - margin + halfW = -0.4 - 0.04 + 0.1 = -0.34
    const camPos = { x: -0.34, y: 0 };
    expect(nudgeVector(camPos, viewport, cloud, 0.04)).toBeNull();
  });
});
