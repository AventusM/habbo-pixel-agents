// tests/kanbanText.test.ts
// Unit tests for kanban note text helpers (truncate, condense, monospace wrap, checklists)

import { describe, it, expect } from 'vitest';
import { truncateText, condenseBlanks, wrapMonospace, parseChecklistSection } from '../src/kanbanText.js';

describe('truncateText', () => {
  it('returns the text unchanged when within maxChars', () => {
    expect(truncateText('hello', 10)).toBe('hello');
    expect(truncateText('exactly-10', 10)).toBe('exactly-10');
  });

  it('truncates with ellipsis when over maxChars', () => {
    const out = truncateText('abcdefghijk', 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('condenseBlanks', () => {
  it('collapses multiple blank lines into one gap', () => {
    expect(condenseBlanks('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('collapses runs of blank lines to a single gap and trims edges', () => {
    expect(condenseBlanks('a\n\n\n\nb')).toBe('a\n\nb');
    expect(condenseBlanks(' a \n\n b \n\n')).toBe(' a \n\n b ');
    expect(condenseBlanks('\n\n a \n\n\n b \n\n')).toBe(' a \n\n b ');
  });

  it('normalizes CRLF', () => {
    expect(condenseBlanks('a\r\n\r\n\r\nb')).toBe('a\n\nb');
  });
});

describe('wrapMonospace', () => {
  it('keeps short text on one line', () => {
    expect(wrapMonospace('hello world', 20, 5)).toEqual(['hello world']);
  });

  it('wraps at maxChars on word boundaries', () => {
    expect(wrapMonospace('the quick brown fox', 10, 5)).toEqual([
      'the quick',
      'brown fox',
    ]);
  });

  it('respects maxLines and marks the last line with an ellipsis', () => {
    const lines = wrapMonospace('aa bb cc dd ee ff gg hh ii jj', 8, 3);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('aa bb cc');
    expect(lines[1]).toBe('dd ee ff');
    expect(lines[2].endsWith('…')).toBe(true);
  });

  it('does not ellipsize when everything fits exactly', () => {
    expect(wrapMonospace('aa bb cc', 8, 3)).toEqual(['aa bb cc']);
  });

  it('respects explicit newlines', () => {
    expect(wrapMonospace('first\nsecond', 20, 5)).toEqual(['first', 'second']);
  });

  it('hard-breaks words longer than maxChars', () => {
    const lines = wrapMonospace('abcdefghij', 4, 10);
    expect(lines).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('hard-breaks long words across the line limit', () => {
    const lines = wrapMonospace('abcdefghijklmnop', 4, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('abcd');
  });
});

describe('parseChecklistSection', () => {
  const PATTERN = /(?:definition of done|\bdod\b|success criteria)/i;

  it('extracts task-list items with state from a bold section', () => {
    const body = [
      'Slice of epic #57. Risk: low.',
      '',
      '**Success criteria:**',
      '- [x] Pack script adapted',
      '- [ ] Avatar walks in room',
      '',
      'Authority: GSD DB. Read-only mirror.',
    ].join('\n');
    expect(parseChecklistSection(body, PATTERN)).toEqual([
      { text: 'Pack script adapted', done: true },
      { text: 'Avatar walks in room', done: false },
    ]);
  });

  it('extracts plain bullets from a DoD section as not-done', () => {
    const body = [
      '**Slices:**',
      '- [ ] S01 — Plan',
      '',
      '**DoD:**',
      '- Decision recorded',
      '- Avatar renders in the room',
    ].join('\n');
    expect(parseChecklistSection(body, PATTERN)).toEqual([
      { text: 'Decision recorded', done: false },
      { text: 'Avatar renders in the room', done: false },
    ]);
  });

  it('supports markdown heading sections and stops at the next heading', () => {
    const body = [
      '## Definition of Done',
      '- [x] done thing',
      '',
      '## Notes',
      '- not part of dod',
    ].join('\n');
    expect(parseChecklistSection(body, PATTERN)).toEqual([
      { text: 'done thing', done: true },
    ]);
  });

  it('returns [] when no matching section exists', () => {
    expect(parseChecklistSection('**Goal:** do the thing\n- item', PATTERN)).toEqual([]);
    expect(parseChecklistSection('', PATTERN)).toEqual([]);
  });
});
