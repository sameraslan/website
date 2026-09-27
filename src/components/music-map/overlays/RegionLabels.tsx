"use client";

import { useCallback } from "react";

import type { RegionRecord } from "../data/types";
import { registerRegionLabelEl } from "../state/regionLabelEls";

interface RegionLabelsProps {
  regions: RegionRecord[];
}

/**
 * DOM overlay: one <span> per region, rendered outside <Canvas> (by
 * MusicMap.tsx, next to the Tooltip) so labels use the site's display font
 * and don't need a per-label canvas texture. Position and opacity are
 * written imperatively every frame by the canvas-side driver
 * (canvas/RegionLabels.tsx) via the state/regionLabelEls.ts bridge, exactly
 * like Tooltip.tsx / TooltipDriver.tsx. `opacity` starts at 0 here so a
 * label never flashes at the origin before the first frame positions it.
 */
export function RegionLabels({ regions }: RegionLabelsProps) {
  const makeRef = useCallback(
    (clusterId: number) => (el: HTMLSpanElement | null) => {
      registerRegionLabelEl(clusterId, el);
    },
    [],
  );

  return (
    <>
      {regions.map((region) => (
        <span
          key={region.clusterId}
          ref={makeRef(region.clusterId)}
          className="font-display italic"
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            fontSize: 22,
            color: region.color,
            pointerEvents: "none",
            opacity: 0,
            whiteSpace: "nowrap",
            willChange: "transform, opacity",
          }}
        >
          {region.label}
        </span>
      ))}
    </>
  );
}
