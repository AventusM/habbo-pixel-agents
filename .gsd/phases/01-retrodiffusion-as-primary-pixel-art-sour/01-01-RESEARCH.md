# M001/S01 — RetroDiffusion evaluation (2026-09-05)

Full evaluation: `.gsd/reports/m001-s01-testgen/EVALUATION.md` (capabilities, style shortlist, measured costs, test generation, pipeline design).

## Verdict
**ADOPT** RetroDiffusion as primary pixel-art source for characters (recorded in DECISIONS).

## Key numbers
- Test gen: rd_pro__default 104x104 x2 = $0.36; both variants Habbo-viable (big head, small body, transparent, clean pixels)
- 48px path: ~$0.86/character; 104px path: ~$3.21/character; balance ~$8.85
- Exact legacy-format match: rd_animation__four_angle_walking_idle (48x48, 4-dir walk+idle)
- 8-dir: rd_animation__8_dir_rotation (80x80, supports reference images)

## Pipeline design
RD hosted URLs -> download to assets/rd/<name>/ -> adapted pack script (same manifest contract) -> esbuild dist -> renderer (frame-size calibration in S02).

## S02 starting point
48px parity first (cheapest), then 104px PixelLab-parity composition.