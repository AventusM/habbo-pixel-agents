# T03: 08-audio 03

**Slice:** S08 — **Milestone:** M001

## Description

Integrate audio system into webview: update CSP for media loading, generate audio URIs in extension host, initialize AudioManager on user gesture, and wire sound playback to avatar spawn events.

Purpose: Complete the audio pipeline integration, making sound effects available in the room with autoplay-compliant initialization and graceful fallback if codec unavailable.
Output: Working audio playback triggered by avatar spawn (demo sound), with manual verification checkpoint to confirm sound works or fails silently.

## Must-Haves

- [ ] "Audio URIs are generated in extension host and passed to webview"
- [ ] "CSP includes media-src directive allowing audio loading"
- [ ] "AudioManager initializes on first user click in RoomCanvas"
- [ ] "Notification sound plays when avatar spawns (if audio available)"

## Files

- `src/extension.ts`
- `src/RoomCanvas.tsx`
