// src/components/RoomStage.tsx
// Presentational room canvas surface (M008/S02, D021 convention).
// Props in, JSX out — the shell owns the canvas ref and the click/context-menu
// handlers; camera drag/pan, wheel zoom and touch gestures stay native in
// CanvasStage, not here.
import type { CSSProperties, MouseEvent, RefObject } from 'react';

/** Full-bleed canvas surface; native pointer gestures are bound by CanvasStage. */
const stageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  touchAction: 'none',
};

export interface RoomStageProps {
  /** Ref to the underlying canvas element, owned by the shell. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Canvas click handler (selection / navigation), owned by the shell. */
  onClick: (event: MouseEvent<HTMLCanvasElement>) => void;
  /** Canvas context-menu handler, owned by the shell. */
  onContextMenu: (event: MouseEvent<HTMLCanvasElement>) => void;
  /** Furniture drag/move pointer handlers (M009/S02), owned by the shell. */
  onMouseDown?: (event: MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove?: (event: MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (event: MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: () => void;
}

export function RoomStage({
  canvasRef,
  onClick,
  onContextMenu,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}: RoomStageProps) {
  return (
    <canvas
      ref={canvasRef}
      style={stageStyle}
      /* camera drag/pan, wheel zoom and touch gestures handled natively by CanvasStage */
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    />
  );
}
