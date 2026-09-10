# Local wall over a Tailscale tailnet

Run the standalone wall (`node scripts/web-server.mjs`) on your own machine and
reach it from any of your devices — laptop, phone, tablet — without a public
cloud deploy.

This is the **S06 / #80** path. It deliberately keeps the server local:
GitHub webhooks cannot reach a tailnet-only URL, and the server must read local
agent JSONL transcripts, so the wall stays on the machine where the agents run
and Tailscale carries the traffic. Decision **D006**.

| Goal                     | How                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| Private by default       | `tailscale serve` — tailnet-only HTTPS on a MagicDNS `*.ts.net` name |
| Live board               | S05 ETag probe (~10s) with no public route; optional webhook for ~1–2s |
| Live agents              | server reads local JSONL transcripts (not available on a remote host) |
| No public host / no lock-in | tailnet-only; funnel is optional and limited to the webhook route |

> **Out of scope (X-3):** live agent avatars from local JSONL transcripts on a
> *remote* host. This guide keeps the server local on purpose.

---

## 0. Prerequisites

- Node.js 22+ and npm 7+ (see `.nvmrc`)
- [Tailscale](https://tailscale.com/download) on the **host** and on every
  device you want to view the wall from
- A GitHub PAT with `repo` read scope (Copilot monitor + ETag probe)
- Optional, for the ~1–2s webhook path: the `gh` CLI, authenticated, and a
  public HTTPS route (see [step 5](#5-optional-low-latency-board-updates-funnel--webhook))

## 1. Run the wall locally

```bash
npm ci
npm run build:web                 # builds dist/web/ + dist/web/server.mjs
cp .env.example .env              # then fill in GITHUB_REPO + GITHUB_TOKEN
node scripts/web-server.mjs       # http://localhost:3000
```

`--project /path/to/project` points the Copilot transcript watcher at another
checkout; `--no-local` disables local agent watching (demo cards only).

## 2. Environment contract

All configuration is environment variables. `.env` is gitignored — **never
commit real tokens or secrets**. `.env.example` is the canonical, secret-free
manifest.

| Variable                    | Required | Description                                                       |
| --------------------------- | -------- | ----------------------------------------------------------------- |
| `GITHUB_REPO`               | Yes      | `owner/repo` — Copilot monitor + issue-based ETag probe.          |
| `GITHUB_TOKEN`              | Yes      | PAT with repo read scope.                                         |
| `GITHUB_PROJECT_OWNER`      | Board    | GitHub user/org owning the Projects v2 board.                     |
| `GITHUB_PROJECT_OWNER_TYPE` | Board    | `org` or `user`.                                                  |
| `GITHUB_PROJECT_NUMBER`     | Board    | Project number from the board URL.                                |
| `WEBHOOK_SECRET`            | Funnel   | Enables `webhook` mode + mandatory HMAC validation.               |
| `PORT`                      | No       | HTTP port (default `3000`).                                       |
| `BOARD_PROBE_INTERVAL`      | No       | ETag probe seconds (default `10`).                                |
| `WEBHOOK_DEBOUNCE_MS`       | No       | Webhook debounce (default `300`).                                 |

Azure DevOps board variables (`AZDO_*`) also live in `.env.example`. Without a
board the wall falls back to demo cards; without tokens it still serves the
demo (`http://localhost:3000/?demo`).

## 3. Install and join Tailscale

```bash
# macOS (Homebrew) — or install the app from tailscale.com/download
brew install --cask tailscale
tailscale up                       # log in; join your tailnet
tailscale status                   # confirm the host is connected
```

Enable **MagicDNS** and **HTTPS certificates** for the tailnet in the
[Tailscale admin console](https://login.tailscale.com/admin/dns). MagicDNS gives
the host its `https://<machine>.<tailnet>.ts.net` name; HTTPS certificates let
Serve terminate TLS and provision a valid cert automatically.

Install Tailscale on your phone too and log in to the **same tailnet**.

## 4. Serve the wall to the tailnet

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3000
tailscale serve status             # prints the MagicDNS URL
```

The output names the URL, for example:

```text
https://my-laptop.pango-lin.ts.net
```

`--bg` runs Serve persistently: it **resumes automatically after a reboot or
`tailscale up`**.

**Phone access:** open the MagicDNS URL in the phone browser (Tailscale VPN on).
The wall loads over HTTPS with no public exposure — `serve` is tailnet-only.

To stop sharing: `tailscale serve --bg --https=443 http://127.0.0.1:3000 off`.

## 5. (Optional) Low-latency board updates: funnel + webhook

With no public route, the S05 **ETag probe** keeps the board fresh at ~10s and
needs nothing else. For ~1–2s updates, expose **only** the webhook route
publicly via `tailscale funnel` and register the GitHub hook.

Funnel can only listen on ports `443`, `8443`, or `10000`, cannot share a port
with `serve`, and only ever mounts what you tell it. Keep Serve on `443` for the
wall and funnel just the webhook path on `8443`:

```bash
tailscale funnel --bg --https=8443 --set-path=/webhooks/github http://127.0.0.1:3000
tailscale funnel status
```

The public URL is `https://<machine>.<tailnet>.ts.net:8443/webhooks/github`.
Only that path is mounted — `https://<machine>.<tailnet>.ts.net:8443/` must not
serve the wall. Generate a long random `WEBHOOK_SECRET`, set it in `.env`, and
register the hook:

```bash
export WEBHOOK_SECRET="$(openssl rand -hex 32)"
# add WEBHOOK_SECRET=... to .env, then restart the server

node scripts/register-webhook.mjs \
  --repo "$GITHUB_REPO" \
  --url "https://<machine>.<tailnet>.ts.net:8443/webhooks/github" \
  --secret "$WEBHOOK_SECRET"
```

`register-webhook.mjs` creates the hook (or updates an existing one with the
same URL) for `issues` + `projects_v2_item`. `--dry-run` prints what it would
do; it never prints the secret. The equivalent raw call is:

```bash
gh api repos/OWNER/REPO/hooks \
  -f name=web -F active=true \
  -f 'events[]=issues' -f 'events[]=projects_v2_item' \
  -f 'config[url]=https://.../webhooks/github' \
  -f 'config[content_type]=json' \
  -f "config[secret]=$WEBHOOK_SECRET"
```

HMAC validation is mandatory on a funnel route: requests whose
`X-Hub-Signature-256` does not match are rejected with `401`. Any tunnel that
gives you a public HTTPS URL works here — this is not Tailscale-specific. When
the funnel is off or unreachable, the probe still keeps the board correct.

## 6. Health check

The server answers `GET /health` with JSON:

```bash
curl -s http://localhost:3000/health
# {"status":"ok","uptimeSeconds":42,"boardSource":"probe","clients":1,"port":3000}
```

`boardSource` is `webhook`, `probe`, or `demo` once a path delivers an update
(`unset` before the first). Point Tailscale/service health checks at
`http://127.0.0.1:3000/health`, or at the tailnet URL for an end-to-end probe.

## 7. Autostart on macOS (launchd)

Keep the wall running (and starting at login) with a LaunchAgent. Replace the
paths with your clone. Create `~/Library/LaunchAgents/com.habbo-pixel-agents.wall.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.habbo-pixel-agents.wall</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOU/habbo-pixel-agents/scripts/web-server.mjs</string>
    <string>--project</string>
    <string>/Users/YOU/habbo-pixel-agents</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOU/habbo-pixel-agents</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/habbo-wall.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/habbo-wall.err</string>
</dict>
</plist>
```

```bash
launchctl load -w ~/Library/LaunchAgents/com.habbo-pixel-agents.wall.plist
# logs: tail -f /tmp/habbo-wall.log /tmp/habbo-wall.err
```

`KeepAlive` restarts the server if it exits; `tailscale serve --bg` restarts the
route. On Linux, use an equivalent systemd user unit.

### Sleep / reboot caveat

A tailnet URL is only reachable while the host is awake and online:

- **Reboot:** both the LaunchAgent and `tailscale serve --bg` restore themselves.
- **Sleep:** if the laptop sleeps, the wall is unreachable until it wakes. For a
  always-on wall, run the host with sleep disabled (`caffeinate`/power settings)
  or on a machine that stays on.
- **Tailscale down:** `tailscale down` drops the route until `tailscale up`.

## 8. Docker / Compose (optional alternative)

Docker is a supported alternative, not the primary path, and it must still run
**on the same machine as your agent transcripts**. Expose the port on localhost
and point `serve`/`funnel` at it exactly as above:

```yaml
# docker-compose.yml
services:
  wall:
    image: node:22
    working_dir: /app
    command: sh -c "npm ci && npm run build:web && node scripts/web-server.mjs"
    ports:
      - "127.0.0.1:3000:3000"
    env_file: .env
    volumes:
      - .:/app
      - agent-transcripts:/transcripts
volumes:
  agent-transcripts:
```

Then `docker compose up -d` and `tailscale serve --bg --https=443 http://127.0.0.1:3000`.
Mount your real transcript directory into the container and pass `--project`
accordingly so agent avatars resolve.

## 9. Verify (manual walkthrough)

Owner-run UAT (O-6); not automatable in CI.

1. `node scripts/web-server.mjs` with `GITHUB_REPO` + `GITHUB_TOKEN` set.
2. `tailscale serve --bg --https=443 http://127.0.0.1:3000`; open the printed
   `https://<machine>.<tailnet>.ts.net` URL **from a phone** on the tailnet.
3. Edit a board issue. Confirm the wall updates in ~10s (`board: probe`). With
   the funnel + webhook configured, confirm ~1–2s (`board: webhook`) and that a
   bad `X-Hub-Signature-256` is rejected with `401`.
4. Confirm agent avatars render and `?demo` falls back without tokens.
5. `curl http://127.0.0.1:3000/health` returns `status: ok`.

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| Phone cannot open the URL | Phone on the tailnet (`tailscale status`); `tailscale serve status` shows the mount. |
| Certificate error | Enable HTTPS certificates for the tailnet in the admin console. |
| `funnel` refuses to start | Funnel needs v1.38.3+, MagicDNS, HTTPS, and a `funnel` node attribute; enable it once via `tailscale funnel` (interactive). |
| Port conflict | Serve and Funnel cannot share a port. Keep Serve on `443` and Funnel on `8443`. |
| Funnel exposes the wall | Mount only `/webhooks/github`; confirm `https://host:8443/` is not served. |
| Board stuck at ~10s | Expected without a reachable webhook; funnel/probe state shows in the status chip and `/health`. |
| Wall unreachable after a while | Host asleep or Tailscale down — see the sleep/reboot caveat. |

## References

- [Hosted deployment (S05 pipeline)](HOSTED-DEPLOYMENT.md) — board sources, webhook registration, latency
- [Copilot agent monitor](COPILOT-AGENT-MONITOR.md) — agent feed setup
- Tailscale: [Serve](https://tailscale.com/kb/1242/tailscale-serve) · [Funnel](https://tailscale.com/kb/1223/funnel) · [MagicDNS](https://tailscale.com/kb/1081/magicdns)
