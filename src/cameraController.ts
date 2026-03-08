// src/cameraController.ts
// Camera pan/zoom state and math for room canvas navigation

/**
 * Camera state for pan/zoom navigation.
 * Mutable fields for renderState ref pattern (no immutable copies in rAF loop).
 */
export interface CameraState {
  panX: number;
  panY: number;
  zoom: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartPanX: number;
  dragStartPanY: number;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

/**
 * Create default camera state: centered, no zoom, not dragging.
 */
export function createCameraState(): CameraState {
  return {
    panX: 0,
    panY: 0,
    zoom: 1.0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  };
}

/**
 * Apply pan offset (mutates state directly for rAF performance).
 */
export function applyPan(state: CameraState, dx: number, dy: number): void {
  state.panX += dx;
  state.panY += dy;
}

/**
 * Apply zoom with pivot point correction so zoom centers on mouse position.
 * Clamps zoom between MIN_ZOOM and MAX_ZOOM.
 *
 * @param state - Camera state to mutate
 * @param delta - Scroll delta (negative = zoom in, positive = zoom out)
 * @param pivotX - Mouse X in screen pixels
 * @param pivotY - Mouse Y in screen pixels
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 */
export function applyZoom(
  state: CameraState,
  delta: number,
  pivotX: number,
  pivotY: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const oldZoom = state.zoom;
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * zoomFactor));

  if (newZoom === oldZoom) return;

  // Pivot correction: keep world point under mouse stationary
  // World point before zoom: worldX = (pivotX - canvasWidth/2) / oldZoom - panX + canvasWidth/2
  // World point after zoom:  worldX = (pivotX - canvasWidth/2) / newZoom - panX' + canvasWidth/2
  // Setting equal and solving for panX':
  // panX' = panX + (pivotX - canvasWidth/2) * (1/newZoom - 1/oldZoom)
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  state.panX += (pivotX - cx) * (1 / newZoom - 1 / oldZoom);
  state.panY += (pivotY - cy) * (1 / newZoom - 1 / oldZoom);
  state.zoom = newZoom;
}

/**
 * Apply camera transform to a 2D rendering context.
 * Combines centering, zoom, and pan into a single transform.
 *
 * Transform order:
 * 1. Translate to canvas center
 * 2. Scale by zoom
 * 3. Translate back by (-center + pan)
 */
export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  state: CameraState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  ctx.translate(cx, cy);
  ctx.scale(state.zoom, state.zoom);
  ctx.translate(-cx + state.panX, -cy + state.panY);
}

/**
 * Convert screen coordinates to world coordinates, accounting for camera transform.
 * Inverse of applyCameraTransform.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  state: CameraState,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  // Inverse: undo translate(cx,cy) -> undo scale -> undo translate(-cx+panX, -cy+panY)
  const x = (screenX - cx) / state.zoom + cx - state.panX;
  const y = (screenY - cy) / state.zoom + cy - state.panY;
  return { x, y };
}

/**
 * Jump camera to center on a specific world position (e.g., a section center).
 */
export function jumpToSection(
  state: CameraState,
  sectionCenterX: number,
  sectionCenterY: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // We want sectionCenter to appear at screen center.
  // From applyCameraTransform: screenX = cx + zoom * (worldX - cx + panX)
  // For worldX = sectionCenterX to map to screenX = cx:
  //   cx = cx + zoom * (sectionCenterX - cx + panX)
  //   0 = sectionCenterX - cx + panX
  //   panX = cx - sectionCenterX
  state.panX = canvasWidth / 2 - sectionCenterX;
  state.panY = canvasHeight / 2 - sectionCenterY;
}
