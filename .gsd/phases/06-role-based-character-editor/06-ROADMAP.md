# M006: Role-Based Character Editor

**Vision:** Every agent role (Atlas, Sisyphus, Prometheus, Hephaestus, core-dev, planning, infrastructure, support) has a distinct, recognizable outfit in the Habbo room — assigned automatically at spawn and customizable through an in-room character editor with live preview and persistence across reloads.

## Success Criteria

- Each of the 8 agent roles renders a distinct outfit at spawn
- Editor allows per-role customization with live WYSIWYG preview
- Outfits persist across reload and apply to live agents without respawn

## Slices

- [ ] **S03: Outfit persistence + restyle live agents** `risk:medium` `depends:[S02]`
  > After this: Customize Sisyphus outfit, reload the page, outfit persists; restyle a live walking agent without respawning it.

## Boundary Map

Not provided.
<!-- gsd:state-version=146:0 -->
