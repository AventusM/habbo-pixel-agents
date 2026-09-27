// scripts/gsd-pr-contract.d.mts
// Type declarations for the contract gate (M010/S03): trailer parse, outcome
// parity, abide/JEV section verification, and the approval re-exports.

export const EXIT_PASS: number;
export const EXIT_REFUSE: number;
export const EXIT_USAGE: number;

export const REFUSALS: string[];

export function jevFixHint(headSha?: string): string;

export interface GsdMetaTrailer {
  milestone: string;
  slice: string;
  parent: string;
  stackedOn: string;
  outcomes: string[];
  humanMerge: boolean;
}

export function parseTrailer(
  body: unknown,
): { ok: true; trailer: GsdMetaTrailer } | { ok: false; error: string; detail?: string };

export function parseIssueOutcomes(body: unknown): string[];
export function parseEvidenceOutcomes(body: unknown): string[];
export function sectionText(body: unknown, name: string): string;

export interface ParityVerdict {
  pass: boolean;
  missing: string[];
  extra: string[];
  reasons: string[];
}

export function checkParity(args: {
  prBody: unknown;
  issueBody: unknown;
  milestone?: string;
  slice?: string;
}): ParityVerdict;

export interface JevRow {
  rule: string;
  where: string;
  band: string;
  evidence: string;
}

export interface JevVerdictLine {
  kind: string;
  reason: string;
}

export function parseJevSection(
  body: unknown,
): { present: boolean; rows: JevRow[]; verdict: JevVerdictLine | null };

export function scopeMatches(scope: unknown, file: unknown): boolean;

export function governedRulesForFiles(
  rubric: { rules?: Array<{ id?: string; status?: string; scope?: unknown; check?: { type?: string } }> } | null | undefined,
  changedFiles: unknown,
): Array<{ id?: string; status?: string; scope?: unknown; check?: { type?: string } }>;

export interface JevSectionVerdict {
  pass: boolean;
  reasons: string[];
  warnings: string[];
  inScope: Array<string | undefined>;
}

export interface JevReport {
  head?: { sha?: string };
  headSha?: string;
  verdict?: string;
  changedFiles?: unknown;
  findings?: Array<{ rule?: string; band?: unknown; files?: unknown }>;
}

export function checkJevSection(args: {
  prBody: unknown;
  changedFiles: unknown;
  rubric: { rules?: Array<{ id?: string; status?: string; scope?: unknown; check?: { type?: string } }> } | null | undefined;
  report?: JevReport | null;
  headSha?: string;
  isAncestor?: ((sha: string, head: string) => boolean) | null;
}): JevSectionVerdict;

export function checkJevReport(args: {
  report: JevReport;
  prHeadSha?: string;
  changedFiles?: unknown;
  rows?: JevRow[];
  isAncestor?: ((sha: string, head: string) => boolean) | null;
}): { pass: boolean; reasons: string[]; warnings: string[] };

export interface ApprovalComment {
  body?: unknown;
  author?: string | { login?: string; type?: string } | null;
  createdAt?: string;
}

export interface FreshApproval {
  body: string;
  author: string;
  createdAt: string;
}

export function isApprovalBody(body: unknown): boolean;

export function findFreshApproval(
  comments: unknown,
  headDateIso: string,
  ownerLogins?: string[] | null,
): { fresh: boolean; approval: FreshApproval | null };

export function approvalLifts(args?: {
  approval?: FreshApproval | null;
  gates?: Record<string, unknown>;
}): { lifted: string[]; stillBlocking: string[] };
