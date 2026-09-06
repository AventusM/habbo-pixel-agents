// src/kanbanText.ts
// Pure text helpers for kanban note rendering.
// Press Start 2P is a monospace face, so char-count-based wrapping is layout-accurate.

/** Truncate text to maxChars, appending an ellipsis when cut */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + '…';
}

/** Collapse runs of blank lines and trim leading/trailing blanks */
export function condenseBlanks(text: string, maxParagraphGaps = 1): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blanks += 1;
      if (blanks <= maxParagraphGaps && out.length > 0) out.push('');
    } else {
      blanks = 0;
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/**
 * Word-wrap text for monospace rendering.
 * Returns at most maxLines lines; the last line gets an ellipsis if content was cut.
 * Explicit newlines are respected; words longer than maxChars are hard-broken.
 */
export function wrapMonospace(text: string, maxChars: number, maxLines: number): string[] {
  const paragraphs = condenseBlanks(text).split('\n');
  const lines: string[] = [];
  let truncated = false;

  const pushLine = (line: string): boolean => {
    if (lines.length >= maxLines) {
      truncated = true;
      return false;
    }
    lines.push(line);
    return true;
  };

  outer: for (const para of paragraphs) {
    if (para.trim() === '') {
      if (!pushLine('')) break;
      continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
      // Hard-break words longer than a full line; final chunk keeps normal wrapping
      if (word.length > maxChars) {
        if (line) {
          if (!pushLine(line)) break outer;
          line = '';
        }
        for (let i = 0; i < word.length; i += maxChars) {
          const chunk = word.slice(i, i + maxChars);
          if (i + maxChars >= word.length) {
            line = chunk;
            break;
          }
          if (!pushLine(chunk)) break outer;
        }
        continue;
      }
      const candidate = line ? line + ' ' + word : word;
      if (candidate.length > maxChars && line) {
        if (!pushLine(line)) break outer;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      if (!pushLine(line)) break outer;
    }
  }

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1] + '…', maxChars);
  }
  return lines;
}

/** A checklist item extracted from a work item body */
export interface ChecklistItem {
  text: string;
  done: boolean;
}

/**
 * Extract list items from the first markdown section whose header matches
 * sectionPattern (e.g. "**DoD:**" or "## Definition of Done").
 * Preserves GitHub task-list state ("- [x]" / "- [ ]"); plain bullets count as
 * not done. Collection stops at the next bold/heading line or a non-list line.
 */
export function parseChecklistSection(body: string, sectionPattern: RegExp): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const isHeaderLine = (l: string) => /^\s*(?:#{1,6}\s|\*\*).+$/.test(l);
  const matchesSection = (l: string) => sectionPattern.test(l);
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (inSection) {
      if (isHeaderLine(line)) {
        if (matchesSection(line)) {
          continue; // repeated matching header, keep collecting
        }
        break; // next section starts
      }
      if (trimmed === '') continue;
      const checkbox = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
      const plainBullet = trimmed.match(/^[-*]\s+(.*)$/);
      if (checkbox) {
        items.push({ text: checkbox[2].trim(), done: checkbox[1].toLowerCase() === 'x' });
        continue;
      }
      if (plainBullet) {
        items.push({ text: plainBullet[1].trim(), done: false });
        continue;
      }
      break; // non-list content ends the section
    }
    if (isHeaderLine(line) && matchesSection(trimmed)) {
      inSection = true;
    }
  }
  return items;
}
