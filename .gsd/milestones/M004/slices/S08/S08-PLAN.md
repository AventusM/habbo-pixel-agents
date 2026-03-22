# S08 Plan: Copilot Agent Rich Activity Display

## Goal

Replace the generic "Working..." / "Waiting for review" speech bubble text for Copilot agent avatars on localhost:3000 with detailed activity derived from GitHub API data — commit messages, workflow phase detection, and progress tracking.

## Tasks

- [x] **T01: Enrich copilotMonitor with commit polling and phase detection** `est:30min`
  Added `fetchPRCommits()`, `getActivitySnapshot()`, and `detectPhase()` to `copilotMonitor.ts`. The monitor now fetches commits per PR, tracks new pushes, detects phase from workflow run names, and emits rich `displayText` instead of static strings.
