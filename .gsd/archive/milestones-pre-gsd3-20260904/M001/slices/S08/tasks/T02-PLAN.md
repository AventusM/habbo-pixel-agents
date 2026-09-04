# T02: 08-audio 02

**Slice:** S08 — **Milestone:** M001

## Description

Obtain Habbo Hotel v14 source sound effects and implement build-time audio conversion from source formats (MP3, WAV, M4A) to OGG Vorbis using FFmpeg, ensuring all audio assets are in VS Code-compatible codec before bundling.

Purpose: Satisfy AUDIO-01 requirement that all Habbo sound effects are converted to OGG Vorbis at build time, avoiding runtime codec issues and ensuring consistent codec across all VS Code installations.
Output: Source audio files obtained from community sources, FFmpeg conversion script integrated into prebuild step, OGG Vorbis files generated in dist/webview-assets/sounds/.

## Must-Haves

- [ ] "Source Habbo sound effects are obtained and placed in assets/sounds-source/"
- [ ] "Build step converts source audio files to OGG Vorbis automatically"
- [ ] "OGG files appear in dist/webview-assets/sounds/ after npm run build"
- [ ] "No MP3 or AAC files are committed to dist/"

## Files

- `scripts/convert-audio-to-ogg.sh`
- `scripts/obtain-habbo-sounds.md`
- `package.json`
- `assets/sounds-source/.gitkeep`
- `dist/webview-assets/sounds/.gitkeep`
