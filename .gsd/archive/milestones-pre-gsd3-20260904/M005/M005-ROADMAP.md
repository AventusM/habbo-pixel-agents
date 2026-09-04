# M005: 

## Vision
TBD

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Extract monitoring core into workspace package | high | — | ✅ | `packages/agent-dashboard/` exists with all monitoring modules, builds independently, and the root repo's `npm run web` still works via workspace link |
| S02 | CLI entry point and standalone server | medium | S01 | ✅ | `agent-dashboard owner/repo` starts a server that polls GitHub and relays events over WebSocket — verified with HTTP 200 and dashboard served |
| S03 | Generic dashboard frontend | medium | S02 | ✅ | the package ships a default dashboard showing agent cards, status, activity — viewable at localhost:3000 (shipped as vanilla HTML in S02) |
| S04 | Complete barrel exports | low | S01, S03 | ✅ | all 23 public functions/types exported from the package barrel |
| S05 | README and packaging | low | S04 | ✅ | the package has documentation, files field, and is ready for consumption |
