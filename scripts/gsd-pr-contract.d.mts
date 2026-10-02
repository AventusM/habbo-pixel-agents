// scripts/gsd-pr-contract.d.mts
// Type declarations for the contract gate (M010/S03): trailer parse, outcome
// parity, and the approval re-exports. abide/JEV judging moved to CI
// (.github/workflows/abide-judge.yml).

export const EXIT_PASS: number;
export const EXIT_REFUSE: number;
export const EXIT_USAGE: number;

export const REFUSALS: string[];

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
