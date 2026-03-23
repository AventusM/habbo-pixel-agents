// src/fileWatcher.ts
// Watches JSONL files for new lines with fallback strategies
// Runs in VS Code extension host (Node.js)

import * as fs from 'fs';

export interface Disposable {
  dispose(): void;
}

/**
 * Read new lines from a file starting at a byte offset.
 *
 * @param filePath - Absolute path to the file
 * @param lastOffset - Byte offset to start reading from
 * @returns Object with new lines and updated offset
 */
export function readNewLines(
  filePath: string,
  lastOffset: number,
): { lines: string[]; newOffset: number } {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size <= lastOffset) {
      return { lines: [], newOffset: lastOffset };
    }

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(stat.size - lastOffset);
    fs.readSync(fd, buffer, 0, buffer.length, lastOffset);
    fs.closeSync(fd);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    return { lines, newOffset: stat.size };
  } catch {
    return { lines: [], newOffset: lastOffset };
  }
}

/**
 * Watch a JSONL file for new lines.
 *
 * Uses fs.watch as primary, falls back to fs.watchFile (1s poll) if unavailable.
 *
 * @param filePath - Absolute path to the JSONL file
 * @param onNewLines - Callback invoked with new lines
 * @returns Disposable to stop watching
 */
export function watchJsonlFile(
  filePath: string,
  onNewLines: (lines: string[]) => void,
): Disposable {
  let offset = 0;

  // Initialize offset to end of file (only process NEW lines)
  try {
    const stat = fs.statSync(filePath);
    offset = stat.size;
  } catch {
    // File may not exist yet
  }

  function checkForNewLines() {
    const { lines, newOffset } = readNewLines(filePath, offset);
    if (lines.length > 0) {
      offset = newOffset;
      onNewLines(lines);
    }
  }

  // Try fs.watch first (inotify/kqueue based)
  let watcher: fs.FSWatcher | null = null;
  let statWatcher: fs.StatWatcher | null = null;

  try {
    watcher = fs.watch(filePath, () => {
      checkForNewLines();
    });

    watcher.on('error', () => {
      // Fallback to polling
      watcher?.close();
      watcher = null;
      startPolling();
    });
  } catch {
    startPolling();
  }

  function startPolling() {
    statWatcher = fs.watchFile(filePath, { interval: 1000 }, () => {
      checkForNewLines();
    });
  }

  return {
    dispose() {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (statWatcher) {
        fs.unwatchFile(filePath);
        statWatcher = null;
      }
    },
  };
}
