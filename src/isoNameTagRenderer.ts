// isoNameTagRenderer.ts
// Name tag rendering with status dots and semi-transparent pill backgrounds

export interface NameTagSpec {
  name: string; // Agent/terminal name to display
  status: 'idle' | 'active' | 'waiting' | 'error'; // Maps to dot color
  anchorX: number; // Avatar head screen X position
  anchorY: number; // Avatar head screen Y position (top of avatar sprite)
}

// Constants
const DOT_RADIUS = 3;
const PADDING = 6;
const PILL_HEIGHT = 16;

// Status color mapping
const STATUS_COLORS = {
  idle: '#00ff00', // Green
  active: '#ffff00', // Yellow
  waiting: '#888888', // Grey
  error: '#ff0000', // Red
};

/**
 * Draw a name tag with status dot and semi-transparent pill background.
 * Name tags render closest to avatar head, above speech bubbles.
 */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  spec: NameTagSpec
): void {
  const { name, status, anchorX, anchorY } = spec;

  // Set font before measureText
  ctx.font = '8px "Press Start 2P"';

  // Get status color
  const statusColor = STATUS_COLORS[status];

  // Measure name text width
  const textWidth = ctx.measureText(name).width;

  // Calculate pill dimensions
  const pillWidth = DOT_RADIUS * 2 + PADDING + textWidth + PADDING;
  const pillHeight = PILL_HEIGHT;

  // Position pill centered above anchor (above speech bubble)
  const pillX = anchorX - pillWidth / 2;
  const pillY = anchorY - 24; // 24px above anchor

  // Draw pill background (semi-transparent black)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2); // Pill shape
  ctx.fill();

  // Draw status dot
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(
    pillX + PADDING + DOT_RADIUS,
    pillY + pillHeight / 2,
    DOT_RADIUS,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Draw name text (yellow for active, white for others)
  ctx.fillStyle = status === 'active' ? '#ffff00' : '#ffffff';
  ctx.textBaseline = 'middle';
  const textX = Math.floor(pillX + DOT_RADIUS * 2 + PADDING * 1.5);
  const textY = Math.floor(pillY + pillHeight / 2);
  ctx.fillText(name, textX, textY);
}
