# T01: 08-audio 01

**Slice:** S08 — **Milestone:** M001

## Description

Create a robust audio manager module that handles Web Audio API initialization, audio loading with graceful codec failure handling, and one-shot sound playback.

Purpose: Establish the core audio playback infrastructure with silent fallback for codec unavailability, ensuring audio failures never break the extension.
Output: AudioManager class with comprehensive unit tests covering autoplay policy, decoding, and error handling.

## Must-Haves

- [ ] "AudioContext is created only after user gesture (autoplay policy)"
- [ ] "Audio files decode successfully when codec available"
- [ ] "Codec failures are caught and return null without crashing"
- [ ] "Sound playback creates new AudioBufferSourceNode per play"

## Files

- `src/isoAudioManager.ts`
- `tests/isoAudioManager.test.ts`
- `tests/setup.ts`
