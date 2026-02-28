import React, { useRef, useEffect } from 'react';
import { parseHeightmap } from './isoTypes.js';
import { initCanvas, computeCameraOrigin, preRenderRoom } from './isoTileRenderer.js';
import type { TileGrid } from './isoTypes.js';

interface RoomCanvasProps {
  heightmap: string;
}

export function RoomCanvas({ heightmap }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef(0);
  const renderState = useRef<{
    offscreenCanvas: OffscreenCanvas | null;
    cameraOrigin: { x: number; y: number };
    mainCtx: CanvasRenderingContext2D | null;
  }>({
    offscreenCanvas: null,
    cameraOrigin: { x: 0, y: 0 },
    mainCtx: null,
  });

  useEffect(() => {
    // Step 1: Get canvas from canvasRef.current — return early if null
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Step 2: Call initCanvas(canvas) -> mainCtx; store in renderState.current.mainCtx
    const mainCtx = initCanvas(canvas);
    renderState.current.mainCtx = mainCtx;

    // Step 3: Parse the heightmap
    const grid: TileGrid = parseHeightmap(heightmap);

    // Step 4: Compute camera origin
    renderState.current.cameraOrigin = computeCameraOrigin(
      grid,
      canvas.offsetWidth,
      canvas.offsetHeight
    );

    // Step 5: Pre-render room
    renderState.current.offscreenCanvas = preRenderRoom(
      grid,
      renderState.current.cameraOrigin,
      canvas.width,
      canvas.height,
      window.devicePixelRatio || 1
    );

    // Step 6: Set runningRef.current = true
    runningRef.current = true;

    // Step 7: Define frame()
    function frame() {
      // FIRST LINE: if (!runningRef.current) return — StrictMode guard
      if (!runningRef.current) return;

      // Get ctx and offscreen from renderState.current
      const ctx = renderState.current.mainCtx;
      const offscreen = renderState.current.offscreenCanvas;

      if (!ctx || !offscreen || !canvas) return;

      // Clear canvas: ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Blit: ctx.drawImage(offscreen, 0, 0) — single drawImage per frame (ROOM-08)
      ctx.drawImage(offscreen, 0, 0);

      // Schedule next: rafIdRef.current = requestAnimationFrame(frame)
      rafIdRef.current = requestAnimationFrame(frame);
    }

    // Step 8: rafIdRef.current = requestAnimationFrame(frame)
    rafIdRef.current = requestAnimationFrame(frame);

    // Step 9: Return cleanup function
    return () => {
      // runningRef.current = false — MUST happen BEFORE cancelAnimationFrame
      runningRef.current = false;
      // cancelAnimationFrame(rafIdRef.current)
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [heightmap]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
