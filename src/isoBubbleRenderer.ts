// isoBubbleRenderer.ts
// Speech bubble rendering using pure Canvas 2D APIs

export interface SpeechBubbleSpec {
  text: string; // Agent log line or tool name
  anchorX: number; // Avatar head screen X position
  anchorY: number; // Avatar head screen Y position (top of avatar sprite)
  maxWidth?: number; // Default 200px for word wrap
  isWaiting?: boolean; // True for animated "..." bubble
}

// Constants
const PADDING = 8;
const LINE_HEIGHT = 16;
const TAIL_HEIGHT = 8;
const CORNER_RADIUS = 8;

/**
 * Split text into multiple lines based on maxWidth, wrapping at word boundaries.
 * If a single word exceeds maxWidth, it will overflow (no truncation).
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      // Current line exceeds max width, push current line and start new one
      lines.push(currentLine);
      currentLine = word;
    } else {
      // Word fits in current line
      currentLine = testLine;
    }
  }

  // Push remaining line
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [''];

  // Cap at MAX_LINES, truncate last visible line with "..."
  const MAX_LINES = 3;
  if (lines.length > MAX_LINES) {
    lines[MAX_LINES - 1] = lines[MAX_LINES - 1] + '...';
    return lines.slice(0, MAX_LINES);
  }

  return lines;
}

/**
 * Draw a speech bubble with word wrapping, optional waiting animation,
 * and triangular tail pointing down at anchor position.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  spec: SpeechBubbleSpec,
  currentTimeMs: number = Date.now()
): void {
  const { text, anchorX, anchorY, maxWidth = 200, isWaiting = false } = spec;

  // Set font BEFORE measureText (measurement depends on font)
  ctx.font = '8px "Press Start 2P"';

  // Override text for waiting animation (cycle 1-3 dots)
  const displayText = isWaiting
    ? '.'.repeat(Math.floor((currentTimeMs % 1500) / 500) + 1)
    : text;

  // Wrap text into lines
  const lines = wrapText(ctx, displayText, maxWidth);

  // Calculate bubble dimensions
  const lineWidths = lines.map(line => ctx.measureText(line).width);
  const maxLineWidth = Math.max(...lineWidths, 0);
  const bubbleWidth = maxLineWidth + PADDING * 2;
  const bubbleHeight = lines.length * LINE_HEIGHT + PADDING * 2;

  // Position bubble centered above anchor
  const bubbleX = anchorX - bubbleWidth / 2;
  const bubbleY = anchorY - bubbleHeight - TAIL_HEIGHT - 4;

  // Draw downward-pointing triangular tail
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY - 4);
  ctx.lineTo(anchorX - 5, bubbleY + bubbleHeight);
  ctx.lineTo(anchorX + 5, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fill();

  // Draw rounded rectangle background
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, CORNER_RADIUS);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw text lines (use Math.floor to avoid sub-pixel blur)
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    const textX = Math.floor(bubbleX + PADDING);
    const textY = Math.floor(bubbleY + PADDING + i * LINE_HEIGHT);
    ctx.fillText(lines[i], textX, textY);
  }
}
