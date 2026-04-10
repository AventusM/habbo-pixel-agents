# S02: Fill transparent gap at wall corner cross-section

**Goal:** Fill the transparent gap at the back corner where the two walls meet
**Demo:** 

## Must-Haves

- Not provided.

## Proof Level

- This slice proves: Not provided.

## Integration Closure

Not provided.

## Verification

- Not provided.

## Tasks

- [x] **T01: Replace corner post with full cross-section fill** `est:10min`
  Replace the thin 4px corner post with a full corner fill quad spanning the gap between left and right wall recessed surfaces, plus a matching top cap.
  - Files: `src/isoWallRenderer.ts`
  - Verify: Visual inspection: no background showing through at wall corner

## Files Likely Touched

- src/isoWallRenderer.ts
