// scripts/jeve-report.mjs
// Pure JEV handoff report builder (Q15): turn abide evidence
// (.abide/events.jsonl) + rubric scopes (.abide/rubric.json) + a git change
// set into one deterministic, inspectable report. No fs/network here: the CLI
// (scripts/hooks/jeve-report.mjs) owns IO and feeds parsed inputs in.

export const GENERATOR = 'jeve-report/1.0.0';

// clear < act < blocked (worst wins). For the overall verdict `unverified`
// sits between clear and act so silence is never reported as "clear".
const BAND_RANK = { clear: 0, act: 1, blocked: 2 };
const VERDICT_RANK = { clear: 0, unverified: 1, act: 2, blocked: 3 };

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => (typeof value === 'string' ? value : '');

/** Parse an events JSONL blob; bad lines and unknown kinds are ignored. */
export function parseEvents(text) {
  const checks = [];
  const skips = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // partial line, noise, or a non-JSON diagnostic
    }
    if (!entry || typeof entry !== 'object') continue;
    if (entry.kind === 'check') checks.push(entry);
    else if (entry.kind === 'skip') skips.push(entry);
  }
  return { checks, skips };
}

/** Glob matcher: `**` crosses `/` (incl. zero dirs); `*`/`?` stay in a segment. */
export function matchGlob(glob, filePath) {
  const pattern = asText(glob);
  const file = asText(filePath).replace(/^\.\//, '');
  if (!pattern) return true;
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      source += `\\${ch}`;
    } else {
      source += ch;
    }
  }
  return new RegExp(`^${source}$`).test(file);
}

/** True when the rule's scope (or its absence = all files) covers the path. */
export function ruleGovernsFile(rule, filePath) {
  if (!rule || typeof rule !== 'object') return false;
  const scope = asArray(rule.scope);
  if (scope.length === 0) return true;
  return scope.some((glob) => matchGlob(glob, filePath));
}

/** Unique active model rules matching at least one changed file (rubric order). */
export function governedModelRules(rubric, changedFiles) {
  const files = asArray(changedFiles);
  const out = [];
  const seen = new Set();
  for (const rule of asArray(rubric && rubric.rules)) {
    if (!rule || typeof rule.id !== 'string' || seen.has(rule.id)) continue;
    if ((rule.status && rule.status !== 'active') || !rule.check || rule.check.type !== 'model') {
      continue; // absent status defaults to active (rubric compiler contract)
    }
    if (!files.some((file) => ruleGovernsFile(rule, file))) continue;
    seen.add(rule.id);
    out.push(rule);
  }
  return out;
}

/** Overall verdict: empty without files or governed rules, else worst band. */
export function decideVerdict(report) {
  const files = asArray(report && report.changedFiles);
  const rules = asArray(report && report.rules);
  if (files.length === 0 || rules.length === 0) return 'empty';
  let verdict = 'clear';
  for (const rule of rules) {
    const band = rule && typeof rule.band === 'string' ? rule.band : 'unverified';
    const known = Object.prototype.hasOwnProperty.call(VERDICT_RANK, band);
    const canonical = known ? band : 'unverified';
    if (VERDICT_RANK[canonical] > VERDICT_RANK[verdict]) verdict = canonical;
  }
  return verdict;
}

function normalizeBand(value) {
  return value === 'clear' || value === 'act' || value === 'blocked' ? value : null;
}

function worstBand(a, b) {
  if (!a) return b;
  if (!b) return a;
  return BAND_RANK[b] > BAND_RANK[a] ? b : a;
}

function maxProbability(a, b) {
  const left = typeof a === 'number' && Number.isFinite(a) ? a : null;
  const right = typeof b === 'number' && Number.isFinite(b) ? b : null;
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function eventAt(event) {
  return event && typeof event.at === 'string' ? event.at : null;
}

function inWindow(event, baseTime) {
  if (!baseTime) return true;
  const at = eventAt(event);
  return at !== null && at >= baseTime;
}

function eventFiles(event) {
  return asArray(event && event.files);
}

function eventTouches(event, changedSet) {
  return eventFiles(event).some((file) => changedSet.has(file));
}

function usageCost(event) {
  const raw = event && event.usage ? event.usage.costUsd : undefined;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Worst band + max probability + verdict count per governed rule id. */
function collectEventEvidence(checks, changedSet, ids) {
  const byRule = new Map();
  for (const id of ids) byRule.set(id, { band: null, probability: null, checks: 0, lastAt: null });
  let costUsd = 0;
  for (const event of checks) {
    if (!eventTouches(event, changedSet)) continue;
    costUsd += usageCost(event);
    const at = eventAt(event);
    for (const verdict of asArray(event.verdicts)) {
      const id = verdict && typeof verdict.ruleId === 'string' ? verdict.ruleId : null;
      const entry = id === null ? undefined : byRule.get(id);
      if (!entry) continue;
      entry.band = worstBand(entry.band, normalizeBand(verdict.band));
      entry.probability = maxProbability(entry.probability, verdict.probability);
      entry.checks += 1;
      if (at && (entry.lastAt === null || at > entry.lastAt)) entry.lastAt = at;
    }
  }
  return { byRule, costUsd };
}

/** Live `abide check` verdicts for sections touching the changed files. */
function collectLiveEvidence(live, changedSet) {
  const byRule = new Map();
  for (const section of asArray(live && live.sections)) {
    if (!asArray(section && section.files).some((file) => changedSet.has(file))) continue;
    for (const verdict of asArray(section && section.verdicts)) {
      const id = verdict && typeof verdict.ruleId === 'string' ? verdict.ruleId : null;
      if (id === null) continue;
      const prev = byRule.get(id) || { band: null, probability: null };
      byRule.set(id, {
        band: worstBand(prev.band, normalizeBand(verdict.band)),
        probability: maxProbability(prev.probability, verdict.probability),
      });
    }
  }
  return byRule;
}

function liveSummary(liveResult) {
  if (!liveResult) return { ran: false, reason: 'live check not requested', spendUsd: 0 };
  const sections = asArray(liveResult.sections);
  const spendUsd =
    typeof liveResult.spendUsd === 'number' && Number.isFinite(liveResult.spendUsd)
      ? liveResult.spendUsd
      : 0;
  return {
    ran: typeof liveResult.ran === 'boolean' ? liveResult.ran : sections.length > 0,
    reason: typeof liveResult.reason === 'string' ? liveResult.reason : null,
    spendUsd,
  };
}

/** Deterministic report for the CLI to serialize. */
export function buildReport(input) {
  const changedFiles = asArray(input.changedFiles);
  const deletedFiles = asArray(input.deletedFiles);
  const changedSet = new Set(changedFiles);
  const baseTime =
    typeof input.baseTime === 'string' && input.baseTime.length > 0 ? input.baseTime : null;
  const generatedAt = input.generatedAt || new Date().toISOString();
  const notes = asArray(input.extraNotes).map((note) => String(note));
  const rubric = input.rubric && typeof input.rubric === 'object' ? input.rubric : {};
  const { checks, skips } = parseEvents(input.eventsText);
  const checksInWindow = checks.filter((event) => inWindow(event, baseTime));
  const skipsInWindow = skips.filter((event) => inWindow(event, baseTime));

  const governed = governedModelRules(rubric, changedFiles);
  const ids = governed.map((rule) => rule.id);
  const { byRule, costUsd } = collectEventEvidence(checksInWindow, changedSet, ids);
  const liveByRule = collectLiveEvidence(input.liveResult, changedSet);

  const rules = governed.map((rule) => {
    const event = byRule.get(rule.id) || { band: null, probability: null, checks: 0, lastAt: null };
    const live = liveByRule.get(rule.id) || { band: null, probability: null };
    const hasEvent = Boolean(event.band);
    const hasLive = Boolean(live.band);
    let evidence = 'none';
    if (hasEvent && hasLive) evidence = 'event+live';
    else if (hasLive) evidence = 'live';
    else if (hasEvent) evidence = 'event';
    return {
      id: rule.id,
      band: hasEvent || hasLive ? worstBand(event.band, live.band) : 'unverified',
      probability: maxProbability(
        hasEvent ? event.probability : null,
        hasLive ? live.probability : null,
      ),
      checks: hasEvent ? event.checks : 0,
      lastAt: hasEvent ? event.lastAt : null,
      evidence,
      scope: Array.isArray(rule.scope) ? rule.scope : null,
    };
  });

  const files = changedFiles.map((filePath) => {
    const fileRules = governed
      .filter((rule) => ruleGovernsFile(rule, filePath))
      .map((rule) => rule.id);
    let lastEventAt = null;
    let touched = false;
    for (const event of checksInWindow) {
      if (!eventFiles(event).includes(filePath)) continue;
      touched = true;
      const at = eventAt(event);
      if (at && (lastEventAt === null || at > lastEventAt)) lastEventAt = at;
    }
    const status = fileRules.length === 0 ? 'no-rules' : touched ? 'checked' : 'unseen';
    return { path: filePath, status, lastEventAt, governedRules: fileRules };
  });

  const allRules = asArray(rubric.rules);
  const lintRules = allRules
    .filter((rule) => rule && rule.status === 'active' && rule.check && rule.check.type === 'lint')
    .map((rule) => rule.id);
  const excludedRules = {
    deferred: allRules.filter((rule) => rule && rule.check && rule.check.type === 'deferred').length,
    unenforceable: allRules.filter(
      (rule) => rule && rule.check && rule.check.type === 'unenforceable',
    ).length,
  };

  if (baseTime) notes.push(`events bounded to base commit time (${baseTime})`);
  if (checksInWindow.length === 0 && skipsInWindow.length === 0) {
    notes.push('no abide events in window');
  }
  const unverifiedIds = rules.filter((rule) => rule.band === 'unverified').map((rule) => rule.id);
  if (unverifiedIds.length > 0) {
    notes.push(`no evidence for governed rule(s): ${unverifiedIds.join(', ')}`);
  }
  if (skipsInWindow.length > 0) {
    const reasons = [...new Set(skipsInWindow.map((event) => asText(event.reason)).filter(Boolean))];
    const listed = reasons.join('; ') || 'no reason given';
    notes.push(
      `${skipsInWindow.length} skip event(s) in window (carry no files): ${listed}`,
    );
  }
  if (lintRules.length > 0) {
    notes.push(
      `${lintRules.length} lint rule(s) enforced by eslint (not scored here): ${lintRules.join(', ')}`,
    );
  }

  const liveInfo = liveSummary(input.liveResult);
  const totals = {
    checks: rules.reduce((sum, rule) => sum + rule.checks, 0),
    clear: rules.filter((rule) => rule.band === 'clear').length,
    act: rules.filter((rule) => rule.band === 'act').length,
    blocked: rules.filter((rule) => rule.band === 'blocked').length,
    unverified: rules.filter((rule) => rule.band === 'unverified').length,
    skips: skipsInWindow.length,
    files: changedFiles.length,
    governedFiles: files.filter((file) => file.governedRules.length > 0).length,
    costUsd: Number((costUsd + liveInfo.spendUsd).toFixed(8)),
  };

  const report = {
    version: 1,
    generator: GENERATOR,
    generatedAt,
    repo: { root: asText(input.repoRoot), name: asText(input.repoName) },
    branch: asText(input.branch),
    base: { ref: asText(input.base && input.base.ref), sha: asText(input.base && input.base.sha) },
    head: {
      sha: asText(input.head && input.head.sha),
      shortSha: asText(input.head && input.head.sha).slice(0, 8),
      subject: asText(input.head && input.head.subject),
    },
    changedFiles,
    deletedFiles,
    rules,
    files,
    lintRules,
    excludedRules,
    live: { ran: liveInfo.ran, reason: liveInfo.reason, spendUsd: liveInfo.spendUsd },
    totals,
    verdict: 'empty',
    notes,
  };
  report.verdict = decideVerdict(report);
  return report;
}

/** One-sentence verdict rationale for the markdown closeout. */
function verdictReason(report) {
  const rules = asArray(report && report.rules);
  const changed = asArray(report && report.changedFiles);
  if (report.verdict === 'empty') {
    return changed.length === 0
      ? 'no changed files in range'
      : 'no model rules govern the changed files';
  }
  const byBand = (band) => rules.filter((rule) => rule.band === band).map((rule) => rule.id);
  const blocked = byBand('blocked');
  if (blocked.length > 0) return `${blocked.length} rule(s) blocked: ${blocked.join(', ')}`;
  const act = byBand('act');
  if (act.length > 0) return `${act.length} rule(s) flagged act: ${act.join(', ')}`;
  const unverified = byBand('unverified');
  if (unverified.length > 0) {
    return `no abide evidence for ${unverified.length} governed rule(s): ${unverified.join(', ')}`;
  }
  return `all ${rules.length} governed rule(s) have clear evidence`;
}

/** Stable, greppable markdown; reviewers read this file, not the JSON. */
export function renderMarkdown(report) {
  const rules = asArray(report && report.rules);
  const files = asArray(report && report.files);
  const changed = asArray(report && report.changedFiles);
  const governedFiles = files.filter((file) => asArray(file && file.governedRules).length > 0).length;
  const lines = [
    `# JEV handoff report — ${String(report.verdict).toUpperCase()}`,
    `head: ${report.head.sha} — ${report.head.subject}`,
    `base: ${report.base.ref} @ ${String(report.base.sha).slice(0, 8)}`,
    `branch: ${report.branch} · generated: ${report.generatedAt}`,
    `changed: ${changed.length} files (${governedFiles} governed)`,
    '',
    '## Rules',
    '| rule | band | prob | evidence | checks | last |',
    '|---|---|---|---|---|---|',
  ];
  if (rules.length === 0) lines.push('| _(none)_ | | | | | |');
  for (const rule of rules) {
    const prob = rule.probability === null ? '-' : rule.probability;
    const last = rule.lastAt === null ? '-' : rule.lastAt;
    lines.push(`| ${rule.id} | ${rule.band} | ${prob} | ${rule.evidence} | ${rule.checks} | ${last} |`);
  }
  lines.push('', '## Files', '| file | status | last event |', '|---|---|---|');
  if (files.length === 0) lines.push('| _(none)_ | | |');
  for (const file of files) {
    const last = file.lastEventAt === null ? '-' : file.lastEventAt;
    lines.push(`| ${file.path} | ${file.status} | ${last} |`);
  }
  lines.push('', '## Verdict', `${report.verdict} — ${verdictReason(report)}`, '');
  return lines.join('\n');
}
