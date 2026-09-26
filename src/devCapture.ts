// src/devCapture.ts
// Browser dev-capture payload + delivery helpers (M009/S01 T03).
//
// The VS Code host keeps its existing path: the room posts
// { type: 'devCapture', screenshot, logs } to the extension, which writes the
// PNG to tmp and copies a path summary to the clipboard. The standalone web
// build has no extension host, so this module builds the same payload and
// delivers it through browser-native downloads (PNG + JSON) plus a best-effort
// clipboard copy of the log lines.
//
// The builders are pure and unit-tested; the DOM helpers are guarded so this
// module can be imported from the `node` vitest environment.

export interface DevCapturePayload {
  type: 'devCapture';
  /** Epoch ms of the capture; also embedded in the download file names. */
  timestamp: number;
  /** PNG data URL captured from the room canvas. */
  screenshot: string;
  /** Snapshot of window.__devLogBuffer (console lines). */
  logs: string[];
}

/** Build the capture payload; mirrors the VS Code postMessage shape. */
export function buildDevCapturePayload(
  screenshot: string,
  logs: readonly string[],
  timestamp: number = Date.now(),
): DevCapturePayload {
  return { type: 'devCapture', timestamp, screenshot, logs: [...logs] };
}

/** `habbo-capture-<epoch-ms>.<extension>` — mirrors the extension's tmp file name. */
export function buildDevCaptureFilename(timestamp: number, extension: 'png' | 'json'): string {
  return `habbo-capture-${timestamp}.${extension}`;
}

/** Click an anchor to download `href` under `filename` (no-op outside a DOM). */
export function triggerDownload(href: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

/** Download a JSON payload as a Blob (no-op outside a DOM). */
export function downloadJson(payload: unknown, filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

/** Copy text to the clipboard when the API is available; never throws. */
export async function copyTextBestEffort(text: string): Promise<boolean> {
  try {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}