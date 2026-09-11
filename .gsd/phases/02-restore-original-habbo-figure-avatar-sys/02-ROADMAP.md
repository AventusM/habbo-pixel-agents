# M002: Restore Original Habbo Figure Avatar System

**Vision:** Restore the Nitro multi-layer Habbo figure avatar system from git history (deleted in 17.8 for copyright): authentic 8-direction walks via 5 sprite directions + mirrors, layered body-part composition with outfit tinting, sitting, blinking, and the sprite-sheet debug grid. Figure assets are downloaded locally per dev machine and gitignored (never committed), matching the furniture asset posture that survived 17.8. The PixelLab/RD single-sprite renderer stays as the fallback when figure assets are absent.

## Success Criteria

- Agents render as original Habbo figures with authentic 8-direction walking (no perspective breaks)
- Restored figure renderer + outfit config tests pass in the current codebase
- Figure assets download locally, gitignored, never committed (verified)
- AvatarDebugGrid (sprite-sheet debug view) restored and reachable
- PixelLab/RD renderer remains the fallback when figure assets are absent

## Slices

- [ ] **S01: Recover & adapt figure renderer code** `risk:medium` `depends:[]`
  > After this: Figure renderer module + outfit config compile in-tree with restored tests passing under vitest (no in-app wiring yet).

- [ ] **S02: Restore figure asset pipeline (local-only assets)** `risk:low` `depends:[S01]`
  > After this: Running the download script fetches figure assets into assets/habbo/ (local only), converts to Nitro sprites, and the manifest lists figures; git status stays clean of figure files.

- [ ] **S03: Wire figure renderer into the room + debug grid** `risk:medium` `depends:[S01,S02]`
  > After this: Agents in localhost:3000 render as original Habbo figures, walking in all 8 directions with correct perspective; debug grid viewable for the figure atlas.

## Boundary Map

| In scope | Out of scope |
|---|---|
| isoAvatarRenderer + avatarOutfitConfig restore from 586772b^ | AvatarBuilderModal/builder UI (follow-up) |
| Figure asset download pipeline (local-only, gitignored) | Committing any figure assets (never) |
| Renderer selection + fallback wiring | Changing the RD/PixelLab pipeline (stays as fallback) |
| AvatarDebugGrid sprite-sheet debug view | Furniture pipeline changes |
<!-- gsd:state-version=17:0 -->
