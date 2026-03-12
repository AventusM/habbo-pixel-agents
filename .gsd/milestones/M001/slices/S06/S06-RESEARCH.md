# Phase 6: UI Overlays - Research

**Researched:** 2026-03-01
**Domain:** Canvas 2D UI rendering (speech bubbles, name tags, text overlays)
**Confidence:** HIGH

## Summary

Phase 6 implements authentic Habbo-style speech bubbles and name tags using pure Canvas 2D drawing APIs (no sprites). The research confirms that modern Canvas 2D provides native `roundRect()` for rounded rectangles (widely supported since April 2023), `fillText()`/`measureText()` for text rendering, and `rgba()` for semi-transparent backgrounds. All UI overlays render after the depth-sorted renderable list to ensure they always appear on top of room geometry, furniture, and avatars.

**Primary recommendation:** Use Canvas 2D `roundRect()` for speech bubble backgrounds, manual triangle paths for the tail, `fillText()` with `measureText()` for word-wrapped text, and `@font-face` declarations in the webview HTML `<head>` to preload Press Start 2P before first render. Avoid `globalAlpha` in favor of per-element `rgba()` fills for better code clarity and performance.

**Key finding:** The existing codebase already sets `imageSmoothingEnabled = false` (Phase 2), ensuring pixel fonts remain crisp at HiDPI resolutions. Text coordinates must use `Math.floor()` for sub-pixel alignment to avoid anti-aliasing blur.

<phase_requirements>
## Phase Requirements

This phase MUST address the following requirements:

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Speech bubbles as white Canvas 2D rounded rectangles with 1-2px dark border and triangular tail above avatar head | Canvas 2D `roundRect()` (widely supported), manual triangle path using `lineTo()` |
| UI-02 | Waiting "..." bubble with three-dot cycling animation (~500ms per step) when agent is in waiting state | Stateful frame counter, render 1-3 dots based on `Math.floor((timestamp % 1500) / 500)` |
| UI-03 | Speech bubble text shows last agent log line/tool name, truncated to ~30 chars, word-wraps at ~200px | `measureText()` for width calculation, manual line-breaking algorithm |
| UI-04 | Name tags as dark semi-transparent pill backgrounds with white/yellow text showing agent/session name | `rgba(0, 0, 0, 0.7)` fills, `roundRect()` for pill shape |
| UI-05 | Name tags include colored status dot: green (idle), yellow (active), grey (waiting), red (error) | 6-8px circle using `arc()`, state-to-color mapping |
| UI-06 | All speech bubbles and name tags drawn after depth-sorted render list (always on top) | Render order: room → furniture → avatars → UI overlays (no depth sorting for UI) |
| UI-07 | Press Start 2P (OFL 1.1) as default font, loaded from bundled TTF via `@font-face` in webview HTML | `<link rel="preload" as="font">` + `@font-face` in `<head>` before script loads |
| UI-08 | Volter/Goldfish font available as opt-in setting, loaded from bundled TTF with licensing disclaimer | Extension settings API + conditional font load, disclaimer in settings UI |
| AGENT-01 | All existing agent behaviors map to isometric avatar action/gesture codes | Speech bubble text sourced from agent state (tool name, log line, waiting state) |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Native | All UI rendering (rounded rectangles, text, paths) | Zero dependencies, native browser API, sufficient performance for UI overlays |
| `roundRect()` | Native (2023+) | Rounded rectangle backgrounds for bubbles and name tags | Native API (widely supported since April 2023), simpler than manual arc/curve paths |
| `fillText()` / `measureText()` | Native | Text rendering and width measurement for word wrap | Standard Canvas 2D text APIs, no external text layout library needed |
| `@font-face` | CSS3 | Web font loading (Press Start 2P, Volter) | Standard font loading mechanism, works in VS Code webview context |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `<link rel="preload">` | HTML5 | Font preloading to prevent FOUT (Flash of Unstyled Text) | Always for default font (Press Start 2P), prevents layout shift on first render |
| `rgba()` fills | CSS Color 4 | Semi-transparent backgrounds for name tags | Preferred over `globalAlpha` (clearer code, better performance for selective transparency) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `roundRect()` native | Manual `quadraticCurveTo()` or `arcTo()` | Native API is simpler and equally performant — only use manual curves if targeting ancient browsers (pre-2023) |
| Per-element `rgba()` | `globalAlpha` property | `globalAlpha` affects all subsequent draws (requires save/restore), `rgba()` is scoped to one fill (clearer intent, no state leakage) |
| `@font-face` in HTML | Dynamic `FontFace` API in JS | HTML `@font-face` loads fonts earlier (before script execution), reduces FOUT risk |

**Installation:**
No external dependencies — all Canvas 2D APIs are native browser features.

Fonts must be bundled locally:
- Press Start 2P: Download from Google Fonts or Font Library (OFL 1.1 license)
- Volter/Goldfish: Download from dafont.com or GitHub eonu/goldfish (freely redistributable per Sulake license)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── isoBubbleRenderer.ts    # Speech bubble rendering (rounded rect + tail + text)
├── isoNameTagRenderer.ts   # Name tag rendering (pill background + status dot + text)
└── RoomCanvas.tsx          # Update frame() to render UI overlays after avatars
```

### Pattern 1: Speech Bubble with Triangle Tail

**What:** White rounded rectangle with 1-2px dark border and downward-pointing triangular tail anchored above avatar head position.

**When to use:** For all agent speech output (log lines, tool names, waiting state).

**Example:**
```typescript
// Source: Canvas 2D roundRect + manual triangle path
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number, // Avatar head screen X
  anchorY: number, // Avatar head screen Y (top)
  maxWidth: number = 200
): void {
  // 1. Word wrap text using measureText()
  const lines = wrapText(ctx, text, maxWidth);

  // 2. Calculate bubble dimensions
  const padding = 8;
  const lineHeight = 16; // Press Start 2P at 8px works best at 16px line height
  const bubbleWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width))) + padding * 2;
  const bubbleHeight = lines.length * lineHeight + padding * 2;

  // 3. Position bubble above avatar head (centered horizontally)
  const bubbleX = Math.floor(anchorX - bubbleWidth / 2);
  const bubbleY = Math.floor(anchorY - bubbleHeight - 12); // 12px gap for tail

  // 4. Draw tail (downward-pointing triangle)
  const tailWidth = 10;
  const tailHeight = 8;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY - 4); // Tail tip points at avatar
  ctx.lineTo(anchorX - tailWidth / 2, bubbleY + bubbleHeight);
  ctx.lineTo(anchorX + tailWidth / 2, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fill();

  // 5. Draw rounded rectangle background
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8); // 8px corner radius
  ctx.fill();
  ctx.stroke();

  // 6. Draw text
  ctx.fillStyle = '#000000';
  ctx.font = '8px "Press Start 2P"'; // Pixel font works best at 8px
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i],
      Math.floor(bubbleX + padding),
      Math.floor(bubbleY + padding + i * lineHeight)
    );
  }
}
```

### Pattern 2: Word Wrapping with measureText()

**What:** Manual line-breaking algorithm using `measureText()` to split text at word boundaries when width exceeds max width.

**When to use:** For all multi-line text rendering (speech bubbles with long text).

**Example:**
```typescript
// Source: Canvas text wrapping pattern (common approach)
function wrapText(
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
      // Line too long — push current line and start new line with word
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
```

### Pattern 3: Name Tag with Status Dot

**What:** Dark semi-transparent pill background with white/yellow text and colored status dot (green/yellow/grey/red).

**When to use:** Always visible above avatar, updates with agent state changes.

**Example:**
```typescript
// Source: Canvas 2D semi-transparent fills + arc for status dot
function drawNameTag(
  ctx: CanvasRenderingContext2D,
  name: string,
  status: 'idle' | 'active' | 'waiting' | 'error',
  anchorX: number, // Avatar screen X (center)
  anchorY: number  // Avatar head screen Y (top) — name tag renders ABOVE speech bubble
): void {
  // 1. Status dot color mapping
  const statusColors = {
    idle: '#00ff00',    // Green
    active: '#ffff00',  // Yellow
    waiting: '#888888', // Grey
    error: '#ff0000',   // Red
  };

  // 2. Measure text
  ctx.font = '8px "Press Start 2P"';
  const textWidth = ctx.measureText(name).width;

  // 3. Calculate pill dimensions
  const dotRadius = 3;
  const padding = 6;
  const pillWidth = dotRadius * 2 + padding + textWidth + padding;
  const pillHeight = 16;
  const pillX = Math.floor(anchorX - pillWidth / 2);
  const pillY = Math.floor(anchorY - 24); // Above speech bubble

  // 4. Draw pill background (semi-transparent)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 70% opaque black
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2); // Half-height radius = pill shape
  ctx.fill();

  // 5. Draw status dot
  ctx.fillStyle = statusColors[status];
  ctx.beginPath();
  ctx.arc(
    pillX + padding + dotRadius,
    pillY + pillHeight / 2,
    dotRadius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 6. Draw name text (white or yellow based on emphasis)
  ctx.fillStyle = status === 'active' ? '#ffff00' : '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    name,
    Math.floor(pillX + dotRadius * 2 + padding * 1.5),
    Math.floor(pillY + pillHeight / 2)
  );
}
```

### Pattern 4: Waiting "..." Animation

**What:** Cycling three-dot animation (. → .. → ... → repeat) at ~500ms per step.

**When to use:** When agent state is "waiting" (waiting for user input, blocked on async operation).

**Example:**
```typescript
// Source: Stateful frame counter pattern
function drawWaitingBubble(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  currentTimeMs: number
): void {
  // Cycle every 1500ms (3 dots × 500ms each)
  const cycleMs = 1500;
  const stepMs = 500;
  const dotCount = Math.floor((currentTimeMs % cycleMs) / stepMs) + 1; // 1, 2, or 3

  const text = '.'.repeat(dotCount); // ".", "..", or "..."

  // Render as normal speech bubble (smaller, no word wrap needed)
  drawSpeechBubble(ctx, text, anchorX, anchorY, 60);
}
```

### Pattern 5: Font Preloading in Webview HTML

**What:** `@font-face` declaration in webview HTML `<head>` with `<link rel="preload">` to prevent FOUT (Flash of Unstyled Text).

**When to use:** Always for default font (Press Start 2P), conditional for opt-in font (Volter).

**Example:**
```typescript
// Source: extension.ts webview HTML generation
const fontUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'PressStart2P-Regular.ttf')
);

panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${panel.webview.cspSource}; img-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; connect-src ${panel.webview.cspSource}; style-src 'unsafe-inline';" />

    <!-- Preload font to prevent FOUT -->
    <link rel="preload" href="${fontUri}" as="font" type="font/ttf" crossorigin />

    <style>
      @font-face {
        font-family: 'Press Start 2P';
        src: url('${fontUri}') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: block; /* Prevents FOUT by blocking text render until font loads */
      }

      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100vh; background: #1a1a2e; }
    </style>
    ...
  </head>
  ...
</html>`;
```

**CRITICAL:** Add `font-src ${panel.webview.cspSource}` to CSP meta tag to allow font loading.

### Anti-Patterns to Avoid

- **Using `globalAlpha` for selective transparency:** Sets global state that affects all subsequent draws — use per-element `rgba()` fills instead for clearer code and no state leakage.
- **Rendering UI overlays before depth-sorted list:** Speech bubbles and name tags MUST render after all room geometry, furniture, and avatars to ensure they're always on top.
- **Not rounding text coordinates:** Sub-pixel coordinates (e.g., 100.5px) cause anti-aliasing blur — always use `Math.floor()` for `fillText()` x/y coordinates.
- **Setting font in loop:** `ctx.font = '...'` is expensive — set once before rendering all text elements with the same font.
- **Using pixel font at wrong sizes:** Press Start 2P works best at multiples of 8px (8px, 16px, 24px) — avoid 10px, 12px, etc.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rounded rectangles | Manual `quadraticCurveTo()` paths for corners | Native `roundRect()` API | Native API is simpler, equally performant, and widely supported (April 2023+) |
| Text measurement | Custom character-width tables | Native `measureText()` API | Accounts for font kerning, ligatures, and rendering variations across browsers/OS |
| Font loading | Custom font loader with retry logic | `@font-face` + `<link rel="preload">` in HTML `<head>` | Browser-native font loading with automatic retry, caching, and FOUT prevention |
| Word wrapping | Complex multi-line text layout engine | Manual `measureText()` loop with word splitting | Canvas doesn't support native multi-line text — simple loop is sufficient for speech bubbles (2-3 lines max) |

**Key insight:** Canvas 2D text APIs are lower-level than DOM text layout (no automatic word wrap, no line-height CSS), but `measureText()` provides accurate width calculations for manual word breaking. Don't build a full text layout engine — speech bubbles rarely exceed 2-3 lines, so simple word-splitting logic is sufficient.

## Common Pitfalls

### Pitfall 1: Font Not Loaded Before First Render (FOUT)

**What goes wrong:** Text renders in fallback system font (e.g., Arial), then "pops" to Press Start 2P when font loads 100-300ms later — creates jarring visual flash.

**Why it happens:** `@font-face` declared in `<style>` triggers font download, but browser may render text with fallback before download completes.

**How to avoid:**
1. Use `<link rel="preload" as="font">` in HTML `<head>` before `<style>` block
2. Set `font-display: block` in `@font-face` (blocks text render until font loads)
3. Verify `font-src ${panel.webview.cspSource}` is in CSP meta tag
4. Use `crossorigin` attribute on `<link rel="preload">` (required even for same-origin fonts)

**Warning signs:**
- Text briefly appears in system font before switching to pixel font
- VS Code Developer Tools console shows "Font failed to load" errors
- Text is invisible for 100-300ms before appearing (font-display: block with slow font load)

### Pitfall 2: Text Renders Blurry Despite imageSmoothingEnabled = false

**What goes wrong:** Pixel font text appears anti-aliased and fuzzy even though sprite rendering is crisp.

**Why it happens:** Canvas text rendering is affected by sub-pixel positioning — `fillText(text, 100.5, 200.7)` causes browser to anti-alias text across pixel boundaries. `imageSmoothingEnabled` only affects `drawImage()`, not text.

**How to avoid:**
1. Always use `Math.floor()` for `fillText()` x/y coordinates
2. Round bubble position calculations before drawing text
3. Use pixel font at multiples of 8px (8px, 16px, etc.) — fractional font sizes cause sub-pixel rendering

**Warning signs:**
- Text looks fuzzy/blurred at 8px font size
- Text sharpness varies across different bubble positions
- Comparing text to sprites shows sprites are crisp but text is soft

### Pitfall 3: Speech Bubble Tail Doesn't Align with Avatar Head

**What goes wrong:** Triangle tail points to empty space instead of avatar center, or overlaps avatar sprite incorrectly.

**Why it happens:** Avatar screen position is calculated from tile coordinates, but bubble must anchor to avatar HEAD position (not foot position). Tail anchor Y must account for avatar sprite height.

**How to avoid:**
1. Calculate avatar head position: `avatarHeadY = tileToScreen(x, y, z).y - AVATAR_HEIGHT` (AVATAR_HEIGHT ≈ 64px for 64px sprite)
2. Use avatar center X (not left edge): `anchorX = tileToScreen(x, y, z).x` (already centered)
3. Offset bubble Y by tail height + gap: `bubbleY = headY - bubbleHeight - tailHeight - gap`

**Warning signs:**
- Tail points to avatar's feet or chest instead of head
- Bubble overlaps avatar sprite
- Tail is horizontally misaligned (not centered on avatar)

### Pitfall 4: UI Overlays Render Behind Furniture/Avatars

**What goes wrong:** Speech bubbles or name tags are partially obscured by furniture or avatars in front of them — breaks "always on top" requirement.

**Why it happens:** UI overlays are added to the depth-sorted renderable list instead of rendering after the list completes.

**How to avoid:**
1. Do NOT create `Renderable` objects for speech bubbles or name tags
2. Render UI overlays in a separate loop AFTER the depth-sorted avatar loop completes
3. Order: room blit → furniture (pre-rendered) → avatars (depth-sorted) → UI overlays (no sorting)

**Warning signs:**
- Name tag disappears behind avatar when another avatar walks in front
- Speech bubble is cut off by furniture edge
- UI elements appear to "pop" in front/behind based on position

### Pitfall 5: Word Wrap Breaks Mid-Word Instead of at Spaces

**What goes wrong:** Long words like "Initializing..." break as "Initiali-" and "zing..." instead of wrapping entire word to next line.

**Why it happens:** Word wrap algorithm measures character-by-character instead of word-by-word.

**How to avoid:**
1. Split text by spaces FIRST: `text.split(' ')`
2. Accumulate words into line until `measureText()` exceeds max width
3. When width exceeded, push current line and start new line with overflowing word
4. Handle edge case: single word wider than maxWidth (truncate with "..." or allow overflow)

**Warning signs:**
- Words break at arbitrary points (not spaces)
- Hyphenation appears in text (none should exist)
- Single long word causes infinite loop (word never fits)

### Pitfall 6: Name Tags Overlap When Avatars Are Close Together

**What goes wrong:** Multiple avatars standing on adjacent tiles have overlapping name tags, making text unreadable.

**Why it happens:** Name tags always render at fixed offset above avatar head — no collision detection or stacking logic.

**How to avoid (Phase 6 scope):**
- Accept overlapping as known limitation (v1 spec doesn't require collision avoidance)
- Ensure name tag background is semi-transparent (70% opacity) so overlapping tags show both partially
- Position tags slightly higher (e.g., 24px above head instead of 16px) to reduce overlap frequency

**How to fix (post-v1):**
- Implement horizontal offset when two avatars within 2 tiles of each other
- Stack name tags vertically when 3+ avatars overlap
- Add slight randomization to tag Y position (±4px jitter)

**Warning signs:**
- Name tags completely obscure each other (100% opaque backgrounds would cause this)
- Text becomes unreadable when 2+ avatars are adjacent
- User reports cannot identify agents in crowded areas

## Code Examples

All examples verified against Canvas 2D API documentation:

### Drawing a Rounded Rectangle Speech Bubble with Border

```typescript
// Source: MDN Canvas 2D roundRect() API
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect

function drawBubbleBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 8
): void {
  // Draw fill
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  // Draw border (separate stroke call for crisp 1-2px border)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();
}
```

### Measuring Text Width for Word Wrap

```typescript
// Source: MDN Canvas 2D measureText() API
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string = '8px "Press Start 2P"'
): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Example usage in word wrap:
const maxWidth = 200;
const testLine = "Agent is searching for files...";
const width = measureTextWidth(ctx, testLine);
if (width > maxWidth) {
  // Wrap to next line
}
```

### Drawing Semi-Transparent Name Tag Background

```typescript
// Source: MDN Canvas 2D fillStyle (rgba colors)
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle

function drawNameTagBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // 70% opaque black background (30% transparent)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2); // Pill shape (half-height radius)
  ctx.fill();
}
```

### Drawing Status Dot with Arc

```typescript
// Source: MDN Canvas 2D arc() API
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arc

function drawStatusDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Usage:
drawStatusDot(ctx, 100, 50, 3, '#00ff00'); // Green idle dot
```

### Rendering Pixel-Perfect Text

```typescript
// Source: Canvas text rendering best practices
// (Sub-pixel positioning causes anti-aliasing blur)

function drawPixelPerfectText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string = '8px "Press Start 2P"'
): void {
  ctx.font = font;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // CRITICAL: Floor coordinates to avoid sub-pixel anti-aliasing
  ctx.fillText(text, Math.floor(x), Math.floor(y));
}
```

### Complete Speech Bubble Renderer

```typescript
// Source: Composite pattern combining roundRect + triangle path + fillText

export interface SpeechBubbleSpec {
  text: string;
  anchorX: number; // Avatar head screen X (center)
  anchorY: number; // Avatar head screen Y (top)
  maxWidth?: number; // Default 200px
}

export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  spec: SpeechBubbleSpec
): void {
  const maxWidth = spec.maxWidth ?? 200;
  const padding = 8;
  const lineHeight = 16;
  const tailWidth = 10;
  const tailHeight = 8;
  const bubbleRadius = 8;

  // 1. Set font for measurement
  ctx.font = '8px "Press Start 2P"';

  // 2. Word wrap text
  const lines = wrapText(ctx, spec.text, maxWidth);

  // 3. Calculate dimensions
  const textWidths = lines.map(line => ctx.measureText(line).width);
  const bubbleWidth = Math.max(...textWidths) + padding * 2;
  const bubbleHeight = lines.length * lineHeight + padding * 2;

  // 4. Position (centered above anchor, with gap for tail)
  const bubbleX = Math.floor(spec.anchorX - bubbleWidth / 2);
  const bubbleY = Math.floor(spec.anchorY - bubbleHeight - tailHeight - 4);

  // 5. Draw tail (white triangle pointing down)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(spec.anchorX, spec.anchorY - 4); // Tip
  ctx.lineTo(spec.anchorX - tailWidth / 2, bubbleY + bubbleHeight); // Left
  ctx.lineTo(spec.anchorX + tailWidth / 2, bubbleY + bubbleHeight); // Right
  ctx.closePath();
  ctx.fill();

  // 6. Draw bubble background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleRadius);
  ctx.fill();

  // 7. Draw bubble border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleRadius);
  ctx.stroke();

  // 8. Draw text lines
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i],
      Math.floor(bubbleX + padding),
      Math.floor(bubbleY + padding + i * lineHeight)
    );
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual arc/curve paths for rounded corners | Native `roundRect()` API | April 2023 (baseline widely available) | Simpler code, no browser compatibility concerns |
| `globalAlpha` for transparency | Per-element `rgba()` fills | CSS Color 4 (2016+) | Clearer intent, no save/restore needed, better performance |
| External web font CDN (Google Fonts) | Bundled TTF with `@font-face` | VS Code webview security model | No network dependency, works offline, respects CSP |
| Dynamic `FontFace` API in JS | `<link rel="preload">` in HTML | HTML5 preload spec (2016+) | Fonts load earlier (before script execution), reduces FOUT |

**Deprecated/outdated:**
- **Manual rounded corners with `quadraticCurveTo()`:** Native `roundRect()` is widely supported (April 2023+) — only use manual curves for exotic corner shapes (different radius per corner, elliptical radii).
- **External font CDN:** VS Code webview CSP blocks external resources — always bundle fonts locally and serve via `webview.asWebviewUri()`.
- **`font-display: swap`:** Causes FOUT (text renders in fallback font, then swaps to web font) — use `font-display: block` for pixel fonts where fallback font is visually jarring.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Speech bubble renders with rounded rect + triangle tail | unit | `npm test tests/isoBubbleRenderer.test.ts` | ❌ Wave 0 |
| UI-02 | Waiting "..." bubble cycles 1-3 dots at 500ms intervals | unit | `npm test tests/isoBubbleRenderer.test.ts::test_waiting_animation` | ❌ Wave 0 |
| UI-03 | Text wraps at ~200px, truncates at ~30 chars | unit | `npm test tests/isoBubbleRenderer.test.ts::test_word_wrap` | ❌ Wave 0 |
| UI-04 | Name tag renders with semi-transparent pill background | unit | `npm test tests/isoNameTagRenderer.test.ts` | ❌ Wave 0 |
| UI-05 | Status dot color maps to state (green/yellow/grey/red) | unit | `npm test tests/isoNameTagRenderer.test.ts::test_status_colors` | ❌ Wave 0 |
| UI-06 | UI overlays render after avatars (always on top) | manual-only | Visual verification in VS Code webview | N/A |
| UI-07 | Press Start 2P loads before first render (no FOUT) | manual-only | Visual verification in VS Code webview | N/A |
| UI-08 | Volter font loads when opt-in setting enabled | manual-only | Extension settings test | N/A |
| AGENT-01 | Speech bubble text sources from agent state | integration | `npm test tests/isoAgentBehavior.test.ts::test_bubble_text` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test tests/isoBubbleRenderer.test.ts tests/isoNameTagRenderer.test.ts` (UI renderer units only)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual visual verification (no FOUT, correct layering) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/isoBubbleRenderer.test.ts` — covers UI-01, UI-02, UI-03 (rounded rect dimensions, tail position, word wrap logic)
- [ ] `tests/isoNameTagRenderer.test.ts` — covers UI-04, UI-05 (pill dimensions, status color mapping)
- [ ] Extend `tests/isoAgentBehavior.test.ts` — add bubble text sourcing test (AGENT-01)

**Manual verification checklist:**
- [ ] UI-06: Open webview, verify speech bubbles appear above all furniture/avatars
- [ ] UI-07: Open webview, confirm no flash of system font (Press Start 2P loads immediately)
- [ ] UI-08: Enable Volter setting, reload webview, verify Volter font renders + disclaimer shown

## Open Questions

1. **Should name tags fade out when avatar is idle for 30+ seconds?**
   - What we know: Always-visible name tags may clutter crowded rooms (5+ agents)
   - What's unclear: User preference — always visible vs. show-on-hover vs. auto-hide
   - Recommendation: Always visible for v1 (simplest), defer fade-out to v2 based on user feedback

2. **Should speech bubbles auto-dismiss after 5-10 seconds or persist until new speech?**
   - What we know: Classic Habbo bubbles persist until new message (no auto-dismiss)
   - What's unclear: Extension context is different (terminal output is continuous, not chat messages)
   - Recommendation: Persist until new log line (matches Habbo behavior), prevents "flickering" when agent logs rapidly

3. **Should extremely long words (40+ chars) truncate with "..." or overflow bubble width?**
   - What we know: File paths and UUIDs can exceed maxWidth as single "word" (no spaces)
   - What's unclear: Truncation loses information, overflow breaks layout
   - Recommendation: Allow overflow for single words (expand bubble width to accommodate), truncate only when text would exceed viewport bounds

## Sources

### Primary (HIGH confidence)
- [MDN: CanvasRenderingContext2D.roundRect()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect) - Native rounded rectangle API, browser support, parameters
- [MDN: CanvasRenderingContext2D.fillText()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText) - Text rendering API
- [MDN: CanvasRenderingContext2D.measureText()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText) - Text width measurement for word wrap
- [MDN: CanvasRenderingContext2D.globalAlpha](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalAlpha) - Global transparency (avoid in favor of rgba)
- [MDN: Canvas API - Applying Styles and Colors](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors) - rgba fills, transparency best practices
- [Google Fonts: Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) - Font license (OFL 1.1), download, web font usage
- [GitHub: eonu/goldfish - Volter Font](https://github.com/eonu/goldfish) - Volter font with Sulake license details

### Secondary (MEDIUM confidence)
- [web.dev: Preload Optional Fonts](https://web.dev/articles/preload-optional-fonts) - Font preloading to prevent FOUT/FOIT
- [CSS-Tricks: Load Fonts to Fight FOUT](https://css-tricks.com/how-to-load-fonts-in-a-way-that-fights-fout-and-makes-lighthouse-happy/) - font-display strategies, preload link
- [scriptol.com: Drawing Speech Bubbles in Canvas](https://www.scriptol.com/html5/canvas/speech-bubble.php) - Speech bubble tail patterns
- [Ben Nadel: Rendering Wrapped Text to Canvas](https://www.bennadel.com/blog/4311-rendering-wrapped-text-to-a-canvas-in-javascript.htm) - Word wrap algorithm implementation
- [PQINA: Wrap Text with HTML Canvas](https://pqina.nl/blog/wrap-text-with-html-canvas) - measureText-based wrapping
- [Three Dots: CSS Loading Animations](https://nzbin.github.io/three-dots/) - Dot animation patterns (CSS reference, adaptable to Canvas)

### Tertiary (LOW confidence)
- [HabboxForum: Sulake Releases Volter Font License](https://habboxforum.com/showthread.php?t=699640) - Volter licensing history
- [Habbo Wiki: Speech Bubble Collectibles](https://help.habbox.game/hc/en-us/articles/6931578301853-Speech-bubble-Collectibles) - Habbo bubble variants (cosmetic variations, not technical specs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Canvas 2D APIs are native browser features with MDN documentation and wide support
- Architecture: HIGH - Speech bubble + name tag patterns are established Canvas 2D UI techniques, verified against existing Habbo visual references
- Pitfalls: HIGH - All pitfalls documented from Canvas 2D API quirks (sub-pixel rendering, font loading timing, depth sorting) with clear prevention strategies

**Research date:** 2026-03-01
**Valid until:** 2027-03-01 (30 days for stable APIs — Canvas 2D text/drawing APIs are mature, no breaking changes expected)