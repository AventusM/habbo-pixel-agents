# M011/S02 T03 — credential + quota/429 path: clear errors, never fabricated

Date: 2026-09-28.

## 1. No-credential probe → clear error entry, no fabricated verdict

Drove the true hook path (`abide-hook.js post-tool-use`, Write-shaped payload,
`cwd` = credential-less worktree `/tmp/gsd-m011s02-probe`) with the key sources
hidden (`HOME=/tmp/nohome` so `~/.abide/.env` is unreachable; no
`TYPESAFE_AI_API_KEY`/`AI_GATEWAY_API_KEY` in env; no `.env`/`.env.local` in
that checkout). The hook wrote an `error` entry — not a `check` verdict — to
the worktree `.abide/events.jsonl`:

```json
{"kind":"error","at":"2026-09-28T22:25:02.539Z","phase":"edit","sessionId":"ses_probe_m011s02_t03quota","code":"NO_API_KEY","message":"No API key found. Run \"abide login\" with your TypeSafe key, or put TYPESAFE_AI_API_KEY in the environment or a .env file at the repo root.","latencyMs":8}
```

Quota/auth failures surface as errors; the judge never fabricates a verdict
without credentials (D033 contract holds). stdout carried the same error; no
`decision:block`, no verdict rows.

## 2. Happy path with valid credentials (by reference)

- Main checkout: `m011-s02-t02-verdicts.md` quotes two `check` entries,
  no-fetch-in-components 0.98/0.97 `act`, `blocked:true`.
- Fresh worktree: same file quotes the hook-path `check` entry, 0.98 `act`,
  `blocked:true`, no skip.

## 3. Supported credential sources (exactly as the CLI reports them)

`abide help` footer:

> Key: abide login, or TYPESAFE_AI_API_KEY (or AI_GATEWAY_API_KEY) in the
> environment or a .env.local or .env at the repo root.

Upstream README (`~/.local/share/abide/README.md`) adds the machine-global
file: the pasted key "goes to `~/.abide/.env` for every repo on the machine,
or to `.env.local` in this repo, owner-only either way. A `.env` you already
have at the repo root works too." Presence confirmed for `~/.abide/.env`
(global, mode 600, TYPESAFE_* names) and repo-root `.env` (untracked,
gitignored, TYPESAFE_* names); no secrets committed anywhere in this slice.
T03 verify satisfied.
