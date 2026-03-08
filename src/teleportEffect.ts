// src/teleportEffect.ts
// Teleport booth flash/glow effect for agent spawn and despawn animations.
// Canvas 2D radial gradient rendered at section teleport tile positions.

/** A teleport flash effect instance */
export interface TeleportEffect {
  /** Screen X position (center of effect) */
  screenX: number;
  /** Screen Y position (center of effect) */
  screenY: number;
  /** Timestamp when effect started (ms) */
  startMs: number;
  /** Total duration of effect (ms) */
  durationMs: number;
  /** Whether this is a spawn or despawn effect */
  type: 'spawn' | 'despawn';
}

/**
 * Create a new teleport flash effect at the given screen position.
 * Default duration is 600ms.
 */
export function createTeleportEffect(
  screenX: number,
  screenY: number,
  type: 'spawn' | 'despawn',
): TeleportEffect {
  return {
    screenX,
    screenY,
    startMs: performance.now(),
    durationMs: 600,
    type,
  };
}

/**
 * Check if a teleport effect is still active (not yet completed).
 */
export function isEffectActive(effect: TeleportEffect, currentMs: number): boolean {
  const elapsed = currentMs - effect.startMs;
  return elapsed < effect.durationMs;
}

/**
 * Draw a teleport flash/glow effect on the canvas.
 * Uses a radial gradient with white center and light blue outer ring.
 * Alpha peaks at progress=0.5 using Math.sin(progress * Math.PI).
 * Radius grows from 20 to 60 pixels over the duration.
 *
 * @returns true if the effect is still active, false when complete
 */
export function drawTeleportFlash(
  ctx: CanvasRenderingContext2D,
  effect: TeleportEffect,
  currentMs: number,
): boolean {
  const elapsed = currentMs - effect.startMs;
  const progress = Math.min(elapsed / effect.durationMs, 1.0);

  if (progress >= 1.0) {
    return false;
  }

  // Alpha peaks at midpoint
  const alpha = Math.sin(progress * Math.PI);

  // Radius grows from 20 to 60
  const radius = 20 + (60 - 20) * progress;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';

  // Radial gradient: white center, light blue outer
  const gradient = ctx.createRadialGradient(
    effect.screenX, effect.screenY, 0,
    effect.screenX, effect.screenY, radius,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(180, 220, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(100, 180, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(effect.screenX, effect.screenY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  return true;
}
