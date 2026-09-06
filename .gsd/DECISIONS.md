# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D001 | M001/S01 evaluation, 2026-09-05. Evidence: .gsd/reports/m001-s01-testgen/EVALUATION.md + base-104-a/b.png | asset-pipeline | Primary source of truth for generated character sprites | Adopt RetroDiffusion (rd_pro__default + animation styles) as the primary generation source; PixelLab archived. Pack-script manifest format retained as the renderer contract. | PixelLab is unavailable; RetroDiffusion is live with reference-image consistency, an exact 48px walk+idle style matching the legacy pack format, 8-dir rotation sets, per-frame advanced animations, free cost estimation, and measured Habbo-viable output quality (test generation 2026-09-05, $0.36). Cost: ~$0.86/char at 48px parity, ~$3.21/char at 104px parity. | Revisit if PixelLab returns or RD quality degrades; 48px-first S02 proof may reshape the 104px composition strategy. | collaborative |
