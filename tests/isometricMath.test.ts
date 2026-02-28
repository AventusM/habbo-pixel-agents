// tests/isometricMath.test.ts
import { describe, it, expect } from 'vitest';
import {
  tileToScreen,
  screenToTile,
  getDirection,
  TILE_W,
  TILE_H,
  TILE_W_HALF,
  TILE_H_HALF,
} from '../src/isometricMath.js';

describe('exported constants', () => {
  it('TILE_W=64, TILE_H=32, TILE_W_HALF=32, TILE_H_HALF=16', () => {
    expect(TILE_W).toBe(64);
    expect(TILE_H).toBe(32);
    expect(TILE_W_HALF).toBe(32);
    expect(TILE_H_HALF).toBe(16);
  });
});

describe('tileToScreen', () => {
  it('tile (0,0,0) -> screen (0,0)', () => {
    expect(tileToScreen(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('tile (1,0,0) -> screen (32,16) — Habbo diamond rightward axis', () => {
    // PITFALL: wrong sign gives {x:-32,y:16}. tileX increases rightward = positive screenX.
    expect(tileToScreen(1, 0, 0)).toEqual({ x: 32, y: 16 });
  });
  it('tile (0,1,0) -> screen (-32,16)', () => {
    expect(tileToScreen(0, 1, 0)).toEqual({ x: -32, y: 16 });
  });
  it('tile (1,1,0) -> screen (0,32)', () => {
    expect(tileToScreen(1, 1, 0)).toEqual({ x: 0, y: 32 });
  });
  it('tile (2,3,0) -> screen (-32,80)', () => {
    expect(tileToScreen(2, 3, 0)).toEqual({ x: -32, y: 80 });
  });
  it('tile (0,0,1) -> screen (0,-16) — z raises tile UPWARD on screen', () => {
    // PITFALL: wrong sign gives {x:0,y:16}. Height lifts upward = negative screenY delta.
    expect(tileToScreen(0, 0, 1)).toEqual({ x: 0, y: -16 });
  });
  it('tile (1,0,1) -> screen (32,0) — height cancels vertical position', () => {
    expect(tileToScreen(1, 0, 1)).toEqual({ x: 32, y: 0 });
  });
  it('tile (3,2,4) -> screen (32,16)', () => {
    // x=(3-2)*32=32, y=(3+2)*16 - 4*16 = 80-64=16
    expect(tileToScreen(3, 2, 4)).toEqual({ x: 32, y: 16 });
  });
  it('default tileZ=0 when omitted', () => {
    expect(tileToScreen(2, 1)).toEqual(tileToScreen(2, 1, 0));
  });
});

describe('screenToTile round-trip', () => {
  it.each([
    [0, 0],
    [1, 0],
    [0, 1],
    [3, 4],
    [5, 2],
    [10, 10],
  ])('round-trip tile (%i,%i,0)', (tx, ty) => {
    const screen = tileToScreen(tx, ty, 0);
    const back = screenToTile(screen.x, screen.y);
    expect(back.x).toBeCloseTo(tx, 10);
    expect(back.y).toBeCloseTo(ty, 10);
  });
});

describe('getDirection', () => {
  it.each([
    [0, 0, 1,  0,  2, 'SE'],
    [0, 0, -1, 0,  6, 'NW'],
    [0, 0, 0,  1,  4, 'SW'],
    [0, 0, 0,  -1, 0, 'NE'],
    [0, 0, 1,  1,  3, 'S'],
    [0, 0, -1, -1, 7, 'N'],
    [0, 0, 1,  -1, 1, 'E'],
    [0, 0, -1, 1,  5, 'W'],
  ])('(%i,%i)->(%i,%i) = dir %i (%s)', (fx, fy, tx, ty, expected) => {
    expect(getDirection(fx, fy, tx, ty)).toBe(expected);
  });
});
