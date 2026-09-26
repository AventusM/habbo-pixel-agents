// src/hooks/useAutoFollowCamera.ts
// Auto-follow camera: every 3s target the most active section, then lerp the
// camera 10% per frame (M008/S01, extracted from RoomCanvas's draw loop).
import { useRef } from 'react';
import { tileToScreen } from '../isometricMath.js';

type CameraLike = { panX: number; panY: number };
type SectionManagerLike = {
  getMostActiveSection(): string | null;
  getSectionCenter(team: string): { x: number; y: number } | null;
};

export function useAutoFollowCamera() {
  const enabledRef = useRef(false);
  const lastCheckRef = useRef(0);
  const targetRef = useRef<{ panX: number; panY: number } | null>(null);

  const setEnabled = (enabled?: boolean) => {
    enabledRef.current = enabled ?? !enabledRef.current;
    if (!enabledRef.current) targetRef.current = null;
  };

  const tick = (
    nowMs: number,
    camera: CameraLike,
    canvasW: number,
    canvasH: number,
    cameraOrigin: { x: number; y: number },
    sectionManager: SectionManagerLike | null,
  ) => {
    if (!enabledRef.current || !sectionManager) return;
    if (nowMs - lastCheckRef.current > 3000) {
      lastCheckRef.current = nowMs;
      const activeTeam = sectionManager.getMostActiveSection();
      if (activeTeam) {
        const center = sectionManager.getSectionCenter(activeTeam);
        if (center) {
          const { x: sx, y: sy } = tileToScreen(center.x, center.y, 0);
          targetRef.current = {
            panX: canvasW / 2 - (sx + cameraOrigin.x),
            panY: canvasH / 2 - (sy + cameraOrigin.y),
          };
        }
      }
    }
    if (targetRef.current) {
      const target = targetRef.current;
      camera.panX += (target.panX - camera.panX) * 0.1;
      camera.panY += (target.panY - camera.panY) * 0.1;
      if (Math.abs(target.panX - camera.panX) < 0.5 && Math.abs(target.panY - camera.panY) < 0.5) {
        camera.panX = target.panX;
        camera.panY = target.panY;
        targetRef.current = null;
      }
    }
  };

  return { setEnabled, tick };
}
