import { describe, it, expect } from 'vitest';
import {
  createCameraState,
  applyPan,
  applyZoom,
  screenToWorld,
  applyCameraTransform,
  jumpToSection,
} from '../src/cameraController.js';

describe('cameraController', () => {
  describe('createCameraState', () => {
    it('should return default state with zoom=1.0 and panX/panY=0', () => {
      const state = createCameraState();
      expect(state.zoom).toBe(1.0);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
      expect(state.isDragging).toBe(false);
    });
  });

  describe('applyPan', () => {
    it('should update panX and panY correctly', () => {
      const state = createCameraState();
      applyPan(state, 10, 20);
      expect(state.panX).toBe(10);
      expect(state.panY).toBe(20);
    });

    it('should accumulate successive pans', () => {
      const state = createCameraState();
      applyPan(state, 5, 3);
      applyPan(state, -2, 7);
      expect(state.panX).toBe(3);
      expect(state.panY).toBe(10);
    });
  });

  describe('applyZoom', () => {
    it('should clamp zoom at minimum 0.3', () => {
      const state = createCameraState();
      state.zoom = 0.31;
      // Zoom out many times
      for (let i = 0; i < 50; i++) {
        applyZoom(state, 1, 400, 300, 800, 600);
      }
      expect(state.zoom).toBeCloseTo(0.3, 1);
    });

    it('should clamp zoom at maximum 2.0', () => {
      const state = createCameraState();
      state.zoom = 1.9;
      // Zoom in many times
      for (let i = 0; i < 50; i++) {
        applyZoom(state, -1, 400, 300, 800, 600);
      }
      expect(state.zoom).toBeCloseTo(2.0, 1);
    });

    it('should zoom in when delta is negative', () => {
      const state = createCameraState();
      const oldZoom = state.zoom;
      applyZoom(state, -1, 400, 300, 800, 600);
      expect(state.zoom).toBeGreaterThan(oldZoom);
    });

    it('should zoom out when delta is positive', () => {
      const state = createCameraState();
      const oldZoom = state.zoom;
      applyZoom(state, 1, 400, 300, 800, 600);
      expect(state.zoom).toBeLessThan(oldZoom);
    });
  });

  describe('screenToWorld', () => {
    it('should return correct world coords at zoom=1.0 and no pan', () => {
      const state = createCameraState();
      const result = screenToWorld(100, 200, state, 800, 600);
      // At zoom=1, no pan: world = screen
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('should account for pan offset', () => {
      const state = createCameraState();
      state.panX = 50;
      state.panY = -30;
      const result = screenToWorld(100, 200, state, 800, 600);
      // world = (screen - cx) / zoom + cx - panX
      expect(result.x).toBe(100 - 50); // 50
      expect(result.y).toBe(200 + 30); // 230
    });

    it('should account for zoom=2.0 scaling', () => {
      const state = createCameraState();
      state.zoom = 2.0;
      const canvasW = 800;
      const canvasH = 600;
      const cx = canvasW / 2; // 400
      const cy = canvasH / 2; // 300

      // Screen center should map to world center (400, 300)
      const center = screenToWorld(cx, cy, state, canvasW, canvasH);
      expect(center.x).toBeCloseTo(cx);
      expect(center.y).toBeCloseTo(cy);

      // A point at screen (600, 450) with zoom=2
      const result = screenToWorld(600, 450, state, canvasW, canvasH);
      // worldX = (600 - 400) / 2 + 400 = 500
      // worldY = (450 - 300) / 2 + 300 = 375
      expect(result.x).toBeCloseTo(500);
      expect(result.y).toBeCloseTo(375);
    });
  });

  describe('jumpToSection', () => {
    it('should set panX/panY to center the target world position', () => {
      const state = createCameraState();
      jumpToSection(state, 500, 400, 800, 600);
      // panX = canvasWidth/2 - sectionCenterX = 400 - 500 = -100
      // panY = canvasHeight/2 - sectionCenterY = 300 - 400 = -100
      expect(state.panX).toBe(-100);
      expect(state.panY).toBe(-100);
    });

    it('should center origin at top-left when canvas is 800x600', () => {
      const state = createCameraState();
      jumpToSection(state, 0, 0, 800, 600);
      expect(state.panX).toBe(400);
      expect(state.panY).toBe(300);
    });
  });

  describe('screenToWorld + applyCameraTransform roundtrip', () => {
    it('world point through transform maps to original screen point', () => {
      const state = createCameraState();
      state.panX = 30;
      state.panY = -20;
      state.zoom = 1.5;
      const canvasW = 800;
      const canvasH = 600;

      // Pick arbitrary screen point
      const screenPt = { x: 250, y: 350 };
      const worldPt = screenToWorld(screenPt.x, screenPt.y, state, canvasW, canvasH);

      // Apply forward transform to world point
      const cx = canvasW / 2;
      const cy = canvasH / 2;
      const backX = cx + state.zoom * (worldPt.x - cx + state.panX);
      const backY = cy + state.zoom * (worldPt.y - cy + state.panY);

      expect(backX).toBeCloseTo(screenPt.x);
      expect(backY).toBeCloseTo(screenPt.y);
    });
  });
});
