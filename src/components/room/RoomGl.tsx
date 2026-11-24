'use client';

// The room as one WebGL canvas (gl/RoomCanvas), inside the room group that
// covers the .rs-root box. The canvas follows the camera rig of the board
// stage, so board and room always share one camera.

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Album } from '@/lib/room';
import { ROOM_LABEL } from './copy';
import { RoomCanvas, type RoomCanvasHandle } from './gl/RoomCanvas';

export function RoomGl({
  stage,
  albums,
  reducedMotion,
  inert,
  onReady,
  onPressRoom,
}: {
  // The board stage, whose rig the canvas follows.
  stage: RefObject<HTMLElement | null>;
  albums: Album[] | null;
  reducedMotion: boolean;
  inert: boolean;
  // The canvas has drawn its first complete frame.
  onReady: () => void;
  // A primary-button press on the room that hits no target.
  onPressRoom: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  const handle = useRef<RoomCanvasHandle>(null);
  // WebGL could not be created, or its context was lost for good: the canvas
  // is hidden.
  const [glUnavailable, setGlUnavailable] = useState(false);

  // Scripts and checks read the canvas's camera and scene through this.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as Record<string, unknown>;
    w.__roomGl = { handle };
    w.__roomGlStats = () => handle.current?.stats();
    return () => {
      delete w.__roomGl;
      delete w.__roomGlStats;
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    onPressRoom(e);
  };

  return (
    <div className="rs-stage-room" role="group" aria-label={ROOM_LABEL} inert={inert ? true : undefined} onPointerDown={onPointerDown}>
      {!glUnavailable && (
        <RoomCanvas
          ref={handle}
          className="rs-gl"
          stage={stage}
          albums={albums}
          hoveredKey={null}
          ringKey={null}
          reducedMotion={reducedMotion}
          onReady={onReady}
          onUnavailable={() => setGlUnavailable(true)}
        />
      )}
    </div>
  );
}
