# S08: Audio

**Goal:** Create a robust audio manager module that handles Web Audio API initialization, audio loading with graceful codec failure handling, and one-shot sound playback.
**Demo:** Create a robust audio manager module that handles Web Audio API initialization, audio loading with graceful codec failure handling, and one-shot sound playback.

## Must-Haves


## Tasks

- [x] **T01: 08-audio 01** `est:2min`
  - Create a robust audio manager module that handles Web Audio API initialization, audio loading with graceful codec failure handling, and one-shot sound playback.

Purpose: Establish the core audio playback infrastructure with silent fallback for codec unavailability, ensuring audio failures never break the extension.
Output: AudioManager class with comprehensive unit tests covering autoplay policy, decoding, and error handling.
- [x] **T02: 08-audio 02** `est:4min`
  - Obtain Habbo Hotel v14 source sound effects and implement build-time audio conversion from source formats (MP3, WAV, M4A) to OGG Vorbis using FFmpeg, ensuring all audio assets are in VS Code-compatible codec before bundling.

Purpose: Satisfy AUDIO-01 requirement that all Habbo sound effects are converted to OGG Vorbis at build time, avoiding runtime codec issues and ensuring consistent codec across all VS Code installations.
Output: Source audio files obtained from community sources, FFmpeg conversion script integrated into prebuild step, OGG Vorbis files generated in dist/webview-assets/sounds/.
- [x] **T03: 08-audio 03** `est:8min`
  - Integrate audio system into webview: update CSP for media loading, generate audio URIs in extension host, initialize AudioManager on user gesture, and wire sound playback to avatar spawn events.

Purpose: Complete the audio pipeline integration, making sound effects available in the room with autoplay-compliant initialization and graceful fallback if codec unavailable.
Output: Working audio playback triggered by avatar spawn (demo sound), with manual verification checkpoint to confirm sound works or fails silently.

## Files Likely Touched

- `src/isoAudioManager.ts`
- `tests/isoAudioManager.test.ts`
- `tests/setup.ts`
- `scripts/convert-audio-to-ogg.sh`
- `scripts/obtain-habbo-sounds.md`
- `package.json`
- `assets/sounds-source/.gitkeep`
- `dist/webview-assets/sounds/.gitkeep`
- `src/extension.ts`
- `src/RoomCanvas.tsx`
