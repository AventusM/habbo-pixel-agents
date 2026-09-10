# Hosted deployment — live wall + board updates

How to run the standalone wall (`node scripts/web-server.mjs`) with live board
updates, and how to register the GitHub webhook that drives them.

This documents the **S05 / #79** board-update pipeline. Actually standing up a
public instance is tracked separately in **#80** and is out of scope here.

## BoardSource port

The server no longer full-polls the board on a fixed 60s timer. A `BoardSource`
(`src/boardSource.ts`) reports the delivery path that most recently updated the
room, and the wall's status chip shows it as `board: <source>`:

| Source    | When it is active                                                        |
| --------- | ------------------------------------------------------------------------ |
| `webhook` | `WEBHOOK_SECRET` is set; GitHub POSTs events to `POST /webhooks/github`.  |
| `probe`   | No webhook secret; a conditional ETag `updatedAt` request every ~10s.     |
| `demo`    | No board configured; the browser falls back to synthetic demo cards.      |

Both live paths share one controller, so a burst of webhook events and a
concurrent probe collapse into a single full fetch. Events are debounced
(`WEBHOOK_DEBOUNCE_MS`, default 300ms) before the fetch.

The probe is a conditional request to the repo's issues endpoint:

```
GET https://api.github.com/repos/OWNER/REPO/issues?state=all&sort=updated&direction=desc&per_page=1
```

GitHub returns an `ETag`; the next probe sends `If-None-Match`. A `304` means
nothing changed and **does not count against the rate limit**, so a full fetch
happens only when the board actually changed.

> Webhooks are the low-latency path (~1–2s after an edit). The probe is the
> fallback (~10s) and is what keeps the wall correct when GitHub cannot reach
> your server. The probe covers issue edits (DoD checklist changes); GitHub
> sends no webhook for column moves unless `projects_v2_item` is subscribed.

## Environment

Copy `.env.example` to `.env`. Board-update variables:

| Variable                    | Required | Description                                                        |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| `GITHUB_REPO`               | Yes      | `owner/repo` — also the probe/webhook target for issue changes.    |
| `GITHUB_TOKEN`              | Yes      | PAT with repo read scope; used by the ETag probe.                  |
| `WEBHOOK_SECRET`            | Hosted   | Shared secret; enables mandatory HMAC validation and webhook mode. |
| `GITHUB_PROJECT_OWNER`      | Yes      | GitHub user/org that owns the Projects v2 board.                   |
| `GITHUB_PROJECT_OWNER_TYPE` | Yes      | `org` or `user`.                                                   |
| `GITHUB_PROJECT_NUMBER`     | Yes      | Project number from the board URL.                                 |
| `PORT`                      | No       | HTTP port (default `3000`).                                        |
| `BOARD_PROBE_INTERVAL`      | No       | Probe interval in seconds (default `10`).                          |
| `WEBHOOK_DEBOUNCE_MS`       | No       | Webhook debounce window (default `300`).                           |

If the probe cannot be configured (missing `GITHUB_REPO` or `GITHUB_TOKEN`), the
server degrades to the legacy full poll so the wall never silently stops
updating.

## Local development

The probe works with no public URL. Start the server:

```bash
npm install
npm run build:web
npm run web:serve          # node scripts/web-server.mjs
# open http://localhost:3000 — chip shows "board: probe"
```

To exercise the webhook path immediately, forward events from GitHub using the
official `cli/gh-webhook` extension (no tunnel needed):

```bash
gh extension install cli/gh-webhook
gh webhook forward \
  --repo=OWNER/REPO \
  --events=issues,projects_v2_item \
  --url=http://localhost:3000/webhooks/github
```

Add `WEBHOOK_SECRET=...` to `.env` and `--secret=...` to the forward command to
exercise HMAC validation locally. With a secret set the server reports
`board: webhook`; without one it reports `board: probe`.

## Hosted recipe

1. **Run the server** (one command after install/build):

   ```bash
   npm ci && npm run build:web && PORT=3000 node scripts/web-server.mjs
   ```

   Put it behind a TLS-terminating proxy and expose a public URL, e.g.
   `https://wall.example.com`.

2. **Set `WEBHOOK_SECRET`** to a long random value. On a public route HMAC
   validation is mandatory, but the server only enforces it when the variable is
   set — so do not skip this step in a hosted environment. Requests whose
   `X-Hub-Signature-256` does not match are rejected with `401`.

3. **Register the webhook** against the public URL:

   ```bash
   gh api repos/OWNER/REPO/hooks \
     -f name=web -F active=true \
     -f 'events[]=issues' -f 'events[]=projects_v2_item' \
     -f 'config[url]=https://wall.example.com/webhooks/github' \
     -f 'config[content_type]=json' \
     -f "config[secret]=$WEBHOOK_SECRET"
   ```

   Content type must be `application/json`; the signature is computed over the
   raw JSON body.

4. **Verify**: edit an issue on the board and watch the wall update within
   ~1–2s, with `board: webhook` in the status chip. Trigger the fallback by
   clearing `WEBHOOK_SECRET` (or pausing the hook): the same edit should appear
   within ~10s with `board: probe`.

### GitHub Pages

Pages can host only the static client; there is no server to receive webhooks or
run the probe. The Pages build stays static-only and falls back to demo cards.

### VS Code extension

The extension host is unchanged: it still polls GitHub Projects on
`habboPixelAgents.githubProject.pollIntervalSeconds` and posts `kanbanCards`
directly into the webview. Webhook/probe delivery is a standalone-web-server
feature only.

## Measured latency

Expected wall-update latency per mode:

| Mode      | Trigger                    | Expected |
| --------- | -------------------------- | -------- |
| `webhook` | GitHub push → debounce → full fetch → WS broadcast | ~1–2s |
| `probe`   | next probe tick (≤10s) → full fetch → WS broadcast | ~10s |

Measure the probe against a live server by editing a board issue and timing the
row from server log (`[Kanban] probe: change detected`) to the broadcast
(`[Kanban] Updated: N cards`). The webhook path is measured the same way with
`gh webhook forward` active.
