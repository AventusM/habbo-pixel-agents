# Obtaining Habbo Hotel Sound Effects

This document provides instructions for obtaining authentic Habbo Hotel v14 sound effects for the Phase 8 audio system.

## Option 1: Community Sound Packs (Recommended for v1)

**101soundboards Habbo Collection:**
- URL: https://www.101soundboards.com/boards/172347-habbo-soundboard
- Contains: ~20 authentic Habbo sound effects (notification chimes, door open/close, footsteps, bubble pop, etc.)
- Format: MP3 (will be converted to OGG Vorbis at build time)
- License: Community-sourced (verify usage rights for your project)

**HabboxWiki SFX Archive:**
- URL: https://habboxwiki.com/SFX
- Contains: Cataloged Habbo sound effects with documentation
- Format: Varies (MP3, WAV)
- Note: Availability of v14-specific sounds may vary

**Instructions:**
1. Visit 101soundboards Habbo collection
2. Download the following priority sound effects for v1 demo:
   - `notification.mp3` — Avatar spawn/notification chime (priority 1)
   - `door_open.mp3` — Room entry sound (optional for v1)
   - `footstep.mp3` — Walking sound effect (optional for v1)
3. Save downloaded files to `assets/sounds-source/`
4. Run `npm run build` — prebuild script will convert to OGG Vorbis automatically

## Option 2: Extract from Habbo v14 SWF (Advanced)

**Requirements:**
- JPEXS Free Flash Decompiler (https://github.com/jindrapetrik/jpexs-decompiler)
- Habbo v14 SWF file (search for "Habbo v14 client SWF" or similar archives)

**Instructions:**
1. Download and install JPEXS Free Flash Decompiler
2. Open Habbo v14 SWF file in JPEXS
3. Navigate to: Resources → Sounds
4. Export sound effects as MP3 or WAV
5. Place in `assets/sounds-source/`
6. Run `npm run build`

**Note:** This method provides the most authentic sounds but requires SWF decompilation knowledge.

## Option 3: Create Placeholder Sounds (Development Only)

If you cannot obtain authentic Habbo sounds, create placeholder sounds for testing:

**Using macOS `say` command:**
```bash
# Generate placeholder notification chime
say -v "Bells" "Ding" -o assets/sounds-source/notification.aiff
ffmpeg -i assets/sounds-source/notification.aiff -acodec libmp3lame assets/sounds-source/notification.mp3
rm assets/sounds-source/notification.aiff
```

**Using online tools:**
- Freesound.org — Creative Commons sound effects
- Search for: "notification bell", "door open", "footstep wood"
- Download as MP3 or WAV

## Minimum Required for v1 Demo

Place at least one file in `assets/sounds-source/`:
- `notification.mp3` (or `.wav`, `.m4a`) — Used for avatar spawn sound in Plan 08-03

If no files are present, the audio system will continue with silent fallback (AUDIO-04 requirement).

## Build Integration

Once source files are in `assets/sounds-source/`:
1. Run `npm run build`
2. Prebuild script executes `scripts/convert-audio-to-ogg.sh`
3. OGG Vorbis files appear in `dist/webview-assets/sounds/`
4. Extension loads and plays sounds via Web Audio API (Plan 08-03)

## Legal Note

If using community-sourced Habbo sound effects, verify licensing rights for your intended use. Habbo Hotel assets are property of Sulake Corporation. This project is for educational/demonstration purposes.
