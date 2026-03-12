---
phase: 8
slug: audio
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0 |
| **Config file** | vitest.config.ts (exists from Phase 1) |
| **Quick run command** | `npm test -- tests/isoAudioManager.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/isoAudioManager.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual CSP verification
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | AUDIO-02, AUDIO-03, AUDIO-04 | unit | `npm test -- tests/isoAudioManager.test.ts -t "loadSound"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | AUDIO-02, AUDIO-03, AUDIO-04 | unit | `npm test -- tests/isoAudioManager.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-00 | 02 | 1 | AUDIO-01 | smoke | `ls dist/webview-assets/sounds/*.ogg` | N/A | ⬜ pending |
| 08-02-01 | 02 | 1 | AUDIO-01 | integration | `bash scripts/convert-audio-to-ogg.sh` | N/A | ⬜ pending |
| 08-02-02 | 02 | 1 | AUDIO-01 | integration | `npm run build 2>&1 | grep -q "audio\|Audio"` | N/A | ⬜ pending |
| 08-03-01 | 03 | 2 | AUDIO-05 | integration | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 08-03-02 | 03 | 2 | AUDIO-03, AUDIO-04 | integration | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 08-03-03 | 03 | 2 | AUDIO-05 | manual | Visual: DevTools console, Network tab | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/isoAudioManager.test.ts` — unit tests for AUDIO-02 (loadSound), AUDIO-03 (init autoplay), AUDIO-04 (silent fallback)
- [ ] `tests/setup.ts` — add AudioContext mock (happy-dom does not provide AudioContext by default)
- [ ] `scripts/convert-audio-to-ogg.sh` — build-time ffmpeg conversion script (created in Wave 1, not true Wave 0)
- [ ] `dist/webview-assets/sounds/` — output directory for OGG Vorbis files (created in Wave 1)

*Note: Wave 0 primarily covers Plan 08-01 test infrastructure. Plans 08-02 and 08-03 build on this foundation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSP media-src directive present in webview HTML | AUDIO-05 | CSP is static HTML string template in extension.ts; no runtime API to query CSP from within webview; checking requires visual inspection of source code or browser DevTools | 1. Run extension (F5), open Habbo Room command<br>2. Open DevTools (Help > Toggle Developer Tools)<br>3. Check Elements tab > `<head>` > `<meta http-equiv="Content-Security-Policy">`<br>4. Verify contains `media-src ${webview.cspSource};`<br>5. Attempt to load audio file, check Console for CSP violations (none expected) |
| Audio plays on avatar spawn OR fails silently (integration of AUDIO-03 + AUDIO-04) | AUDIO-03, AUDIO-04 | Integration behavior requires human interaction (user click to satisfy autoplay policy) and auditory confirmation (hearing sound vs silence); automated webview tests could mock AudioContext but cannot verify actual audio playback in VS Code runtime | 1. Run extension (F5), open Habbo Room<br>2. Click canvas once (initialize AudioManager per AUDIO-03)<br>3. Check DevTools console for "AudioContext initialized, state: running"<br>4. Watch avatar spawn animation<br>5. Expected: sound plays (if .ogg exists) OR silent (if not), no errors either way<br>6. Check Network tab for audio file load (200 or 404 both valid) |

*Manual verification is unavoidable for AUDIO-05 (CSP is static template, no runtime introspection) and AUDIO-03/AUDIO-04 integration (requires user gesture + auditory/visual confirmation in real VS Code webview).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (08-01 has Wave 0 tests; 08-02 has inline automated commands; 08-03 has automated build checks + documented manual verification for CSP/integration)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (08-01-01, 08-01-02 both automated; 08-02 tasks have inline automation; 08-03-01, 08-03-02 automated build/typecheck)
- [x] Wave 0 covers all MISSING references (tests/isoAudioManager.test.ts, tests/setup.ts AudioContext mock)
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 2s (Vitest runs in ~2s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-01
