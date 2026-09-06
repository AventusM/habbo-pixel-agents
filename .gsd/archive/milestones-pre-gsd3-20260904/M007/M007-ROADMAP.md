# M007: PixelLab Character Import

## Vision
Import the latest PixelLab character (habbo_inspiration_new, 104×104, 8 directions, walk + idle animations) as a usable avatar in the Habbo room — producing a packed spritesheet in the same format as the existing 48px characters, with the renderer calibrated to handle the new frame size.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Download & pack spritesheet | low | — | ✅ | assets/pixellab/habbo-inspiration-new.png exists with correct frame layout |
| S02 | Wire into renderer & calibrate | medium | S01 | ⬜ | habbo_inspiration_new avatar walks in the room correctly at the right scale |
