// tests/issue-pr-contract.test.ts
// Fixture for M010/S01: asserts the canonical issue + PR templates render the
// identical skeleton defined in docs/guides/ISSUE-PR-CONTRACT.md
// (required sections, O-N outcome-ID placeholders, gsd-meta trailer keys, and
// the abide/JEV pointer to the CI judge).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sliceTemplate = readFileSync(resolve(root, '.github/ISSUE_TEMPLATE/gsd-slice.yml'), 'utf8');
const prTemplate = readFileSync(resolve(root, '.github/pull_request_template.md'), 'utf8');

const TRAILER_KEYS = ['milestone:', 'slice:', 'parent:', 'stacked-on:', 'outcomes:', 'human-merge:'];

describe('gsd-slice issue template', () => {
  it('carries every canonical issue section', () => {
    for (const section of ['Goal', 'Demo', 'Outcomes', 'Exclusions', 'GSD tasks']) {
      expect(sliceTemplate).toContain(section);
    }
  });

  it('uses O-N outcome and X-N exclusion placeholders', () => {
    expect(sliceTemplate).toContain('O-1');
    expect(sliceTemplate).toContain('O-2');
    expect(sliceTemplate).toContain('X-1');
  });

  it('emits every gsd-meta trailer key', () => {
    expect(sliceTemplate).toContain('gsd-meta');
    for (const key of TRAILER_KEYS) {
      expect(sliceTemplate).toContain(key);
    }
  });
});

describe('slice PR template', () => {
  it('links the slice issue and tables per-outcome evidence', () => {
    expect(prTemplate).toContain('Linked slice issue');
    expect(prTemplate).toContain('Outcome evidence');
    expect(prTemplate).toContain('O-1');
    expect(prTemplate).toContain('O-2');
  });

  it('emits every gsd-meta trailer key', () => {
    expect(prTemplate).toContain('gsd-meta');
    for (const key of TRAILER_KEYS) {
      expect(prTemplate).toContain(key);
    }
  });

  it('points abide/JEV at the CI judge instead of a hand-written table', () => {
    expect(prTemplate).toContain('abide/JEV compliance');
    expect(prTemplate).toContain('abide-judge.yml');
    expect(prTemplate).not.toContain('Where applied');
  });
});

describe('issue and PR skeletons stay identical', () => {
  it('share the same trailer keys and outcome IDs', () => {
    for (const key of TRAILER_KEYS) {
      expect(sliceTemplate).toContain(key);
      expect(prTemplate).toContain(key);
    }
    expect(sliceTemplate).toContain('O-1');
    expect(prTemplate).toContain('O-1');
  });
});
