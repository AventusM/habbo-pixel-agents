// src/isoTypes.ts
// Pure data types and logic for isometric tile rendering
// No DOM/canvas imports — runs in Node environment

/**
 * A 2D grid of tile heights parsed from a Habbo heightmap string.
 * null represents void tiles (x/X characters or unknown chars).
 */
export interface TileGrid {
  /** 2D array of tiles: tiles[row][col] */
  tiles: Array<Array<{ height: number } | null>>;
  /** Width of the grid (max row length) */
  width: number;
  /** Height of the grid (number of rows) */
  height: number;
}

/**
 * HSB (Hue, Saturation, Brightness) color representation.
 * Used by Habbo layout editor for tile colors.
 */
export interface HsbColor {
  /** Hue: 0-360 degrees */
  h: number;
  /** Saturation: 0-100 percent */
  s: number;
  /** Brightness: 0-100 percent */
  b: number;
}

/**
 * A renderable object with tile coordinates and a draw function.
 * Used for depth sorting in the rendering pipeline.
 */
export interface Renderable {
  /** Tile X coordinate */
  tileX: number;
  /** Tile Y coordinate */
  tileY: number;
  /** Tile Z coordinate (height level 0-9) */
  tileZ: number;
  /** Draw function to render this object to a canvas context */
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void;
}

/**
 * Parse a Habbo heightmap string into a typed 2D grid.
 *
 * Format:
 * - '0'-'9': walkable tile with height 0-9
 * - 'x' or 'X': void (no tile)
 * - Any other char: treated as void
 * - Rows separated by \n or \r\n
 * - Uneven rows padded with null to match max width
 *
 * @param heightmap - Heightmap string (newline-separated rows of chars)
 * @returns TileGrid with tiles, width, height
 */
export function parseHeightmap(heightmap: string): TileGrid {
  const rows = heightmap.split(/\r?\n/);
  const width = Math.max(...rows.map(row => row.length));
  const height = rows.length;

  const tiles: Array<Array<{ height: number } | null>> = [];

  for (let y = 0; y < height; y++) {
    const row: Array<{ height: number } | null> = [];
    const rowStr = rows[y];

    for (let x = 0; x < width; x++) {
      const char = rowStr[x];

      if (char === undefined) {
        // Pad short rows with null
        row.push(null);
      } else if (char >= '0' && char <= '9') {
        // Parse digit as tile height
        row.push({ height: parseInt(char, 10) });
      } else {
        // Void tile (x, X, or any unknown char)
        row.push(null);
      }
    }

    tiles.push(row);
  }

  return { tiles, width, height };
}

/**
 * Convert HSB color to HSL color.
 *
 * Formula reference: rapidtables.com/convert/color/hsb-to-hsl.html
 *
 * HSL lightness = brightness × (2 - saturation/100) / 2
 * HSL saturation = (brightness - lightness) / min(lightness, 100 - lightness)
 *
 * @param hsb - HSB color {h: 0-360, s: 0-100, b: 0-100}
 * @returns HSL color {h: 0-360, s: 0-100, l: 0-100}
 */
export function hsbToHsl(hsb: HsbColor): { h: number; s: number; l: number } {
  const { h, s, b } = hsb;

  // Convert to 0-1 range for calculation
  const sNorm = s / 100;
  const bNorm = b / 100;

  // Calculate lightness
  const lNorm = (bNorm * (2 - sNorm)) / 2;

  // Calculate saturation (handle edge cases)
  let sHslNorm = 0;
  if (lNorm > 0 && lNorm < 1) {
    sHslNorm = (bNorm - lNorm) / Math.min(lNorm, 1 - lNorm);
  }

  // Convert back to percentage and round
  const l = Math.round(lNorm * 100);
  const sHsl = Math.round(sHslNorm * 100);

  return { h, s: sHsl, l };
}

/**
 * Generate HSL color strings for tile faces (top, left, right).
 *
 * Lighting model:
 * - Top face: base lightness
 * - Left face: base lightness - 10% (clamped to 0%)
 * - Right face: base lightness - 20% (clamped to 0%)
 *
 * @param hsb - HSB color from layout editor
 * @returns Object with top, left, right HSL color strings
 */
export function tileColors(hsb: HsbColor): { top: string; left: string; right: string } {
  const { h, s, l } = hsbToHsl(hsb);

  const lLeft = Math.max(0, l - 10);
  const lRight = Math.max(0, l - 20);

  return {
    top: `hsl(${h}, ${s}%, ${l}%)`,
    left: `hsl(${h}, ${s}%, ${lLeft}%)`,
    right: `hsl(${h}, ${s}%, ${lRight}%)`,
  };
}

/**
 * Sort renderables in back-to-front order for painter's algorithm.
 *
 * Sort key: tileX + tileY + tileZ * 0.001
 *
 * This ensures:
 * - Tiles further back (lower X+Y) render first
 * - Height (Z) is a tiebreaker (0.001 weight prevents Z from overriding X+Y position)
 * - Stair tiles (high Z) stay behind lower-position tiles
 * - Stable sort preserves original order for identical keys
 *
 * @param renderables - Array of renderables with tileX, tileY, tileZ
 * @returns New sorted array (does not mutate input)
 */
export function depthSort(renderables: Renderable[]): Renderable[] {
  return [...renderables].sort((a, b) => {
    const keyA = a.tileX + a.tileY + a.tileZ * 0.001;
    const keyB = b.tileX + b.tileY + b.tileZ * 0.001;
    return keyA - keyB;
  });
}
