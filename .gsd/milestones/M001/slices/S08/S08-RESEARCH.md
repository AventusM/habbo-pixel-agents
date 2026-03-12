# Phase 8: Audio - Research

**Researched:** 2026-03-01
**Domain:** Web Audio API in VS Code webviews with codec constraints
**Confidence:** HIGH

## Summary

Phase 8 requires replacing flat notification chimes with authentic Habbo Hotel classic sound effects while maintaining silent fallback if the audio codec is unavailable. This research confirms that VS Code webviews support the Web Audio API with specific codec constraints: OGG Vorbis and WAV are reliably supported, while MP3/AAC require ffmpeg codecs that may be absent in some VS Code builds.

The Web Audio API's `AudioContext.decodeAudioData()` method provides the standard interface for loading and playing audio from ArrayBuffer data. The key architectural challenge is graceful degradation—audio loading failures must not break the extension or present errors to the user. The recommended approach is to fetch audio files via `webview.asWebviewUri()`, decode them with try/catch error handling, and continue with silent fallback if decoding fails.

VS Code webviews require specific CSP directives (`media-src ${webview.cspSource}`) to permit audio playback. AudioContext creation must be gated behind user interaction to comply with browser autoplay policies—the context will be created in a "suspended" state until the user clicks or interacts with the webview, at which point `audioContext.resume()` must be called.

**Primary recommendation:** Use OGG Vorbis for all audio assets (pre-converted at build time via ffmpeg), load via fetch + decodeAudioData with try/catch wrapping, store decoded AudioBuffers in a cache, play via createBufferSource nodes (one-shot, create new node per play), and fail silently if codec unavailable.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIO-01 | All Habbo sound effects are converted to OGG Vorbis (or uncompressed WAV) at build time; no MP3 or AAC files are used. | OGG Vorbis reliably supported in VS Code webviews (confirmed by VS Code issue #180780); ffmpeg conversion via `libvorbis` codec; WAV also supported as uncompressed fallback |
| AUDIO-02 | Audio files are served via `webview.asWebviewUri()` and loaded using `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`. | Standard VS Code webview resource loading pattern; `asWebviewUri()` converts local URIs to webview-accessible URIs; `decodeAudioData()` is the Web Audio API standard for ArrayBuffer decoding |
| AUDIO-03 | `AudioContext` creation is gated behind a user gesture to comply with browser autoplay policy. | Autoplay policy requires user interaction before AudioContext can play; context created in "suspended" state, must call `resume()` after user click/keypress event |
| AUDIO-04 | If audio codec loading fails, the extension falls back to silence — no error is shown to the user and no other feature is broken. | DOMException "EncodingError" thrown by `decodeAudioData()` on codec failure; try/catch pattern prevents error propagation; silent fallback = skip audio playback, continue normal operation |
| AUDIO-05 | The `media-src ${webview.cspSource};` directive is included in the webview CSP meta tag. | CSP `media-src` directive controls `<audio>` and `<video>` element sources; required for Web Audio API audio loading from webview URIs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser built-in | Audio playback, decoding, node-based audio graph | Native browser API for low-latency audio; supported in all modern browsers and Electron/VS Code webviews since 2013 |
| AudioContext | Browser built-in | Audio processing context and node factory | Core Web Audio API interface; manages audio destination, sample rate, and node lifecycle |
| AudioContext.decodeAudioData() | Browser built-in | Decode audio file data from ArrayBuffer to AudioBuffer | Asynchronous, promise-based decoder for all supported codecs; resamples to context sample rate automatically |
| AudioBufferSourceNode | Browser built-in | One-shot audio playback node | Lightweight, create-per-play pattern; connects AudioBuffer to destination for playback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ffmpeg | 4.x+ | Build-time audio conversion to OGG Vorbis | Pre-build step to convert MP3/AAC/other formats to VS Code-compatible codecs |
| fetch() | Browser built-in | Fetch audio files as ArrayBuffer | Standard async resource loading; integrates with `asWebviewUri()` for local file access |
| vscode.webview.asWebviewUri() | VS Code API 1.80+ | Convert local file paths to webview-accessible URIs | Required for all webview resource loading (images, audio, fonts) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio API | `<audio>` HTML element | HTML `<audio>` is simpler but lacks low-latency playback, precise timing control, and programmatic control over multiple overlapping sounds; Web Audio API required for game-like sound effects |
| OGG Vorbis | MP3 | MP3 requires ffmpeg proprietary codecs that may be absent in some VS Code builds; OGG Vorbis is open-source and reliably supported |
| WAV uncompressed | OGG Vorbis | WAV has 100% browser support but much larger file size (10x+); OGG Vorbis provides good compression with wide support |
| AudioBuffer cache | Reload per play | Reloading audio files on every play is prohibitively slow; decoded AudioBuffers are reusable and cheap to store |

**Installation:**
```bash
# No npm packages required — Web Audio API is browser built-in
# Build-time dependency: ffmpeg (system install, not npm)
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Linux
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── isoAudioManager.ts       # AudioContext lifecycle, user gesture handling, sound cache
├── webview.tsx              # Initialize audio manager after user interaction
└── extension.ts             # Generate audio file URIs via asWebviewUri()

dist/
└── webview-assets/
    └── sounds/
        ├── notification.ogg
        ├── door_open.ogg
        └── footstep.ogg

scripts/
└── convert-audio-to-ogg.sh  # Build-time ffmpeg conversion script
```

### Pattern 1: Lazy AudioContext Initialization with User Gesture
**What:** AudioContext is created only after the user's first interaction (click/keypress), then `resume()` is called to unlock autoplay.
**When to use:** All Web Audio API usage in browsers/webviews (autoplay policy requirement)
**Example:**
```typescript
// Source: MDN Web Audio API Best Practices
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

let audioContext: AudioContext | null = null;

function initAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Attach to user gesture (e.g., canvas click)
canvas.addEventListener('click', () => {
  initAudioContext();
  // Now safe to play audio
});
```

### Pattern 2: Fetch + Decode + Cache Pattern
**What:** Load audio file via fetch, decode via `decodeAudioData()`, store decoded AudioBuffer in cache for reuse.
**When to use:** All audio loading in Web Audio API applications
**Example:**
```typescript
// Source: MDN BaseAudioContext.decodeAudioData
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

const audioCache = new Map<string, AudioBuffer>();

async function loadSound(uri: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  if (audioCache.has(uri)) {
    return audioCache.get(uri)!;
  }

  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioCache.set(uri, audioBuffer);
    return audioBuffer;
  } catch (error) {
    console.warn('Audio loading failed (codec unavailable or file corrupt), continuing silently:', error);
    return null;  // Silent fallback
  }
}
```

### Pattern 3: One-Shot AudioBufferSourceNode Playback
**What:** Create a new AudioBufferSourceNode for each sound playback (nodes are single-use).
**When to use:** Playing sound effects (not background music loops)
**Example:**
```typescript
// Source: MDN AudioBufferSourceNode
// https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode

function playSound(audioBuffer: AudioBuffer, ctx: AudioContext): void {
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start(0);  // Play immediately; can only call start() once per node
}

// Usage: create new source node for each play
playSound(notificationBuffer, audioContext);
playSound(notificationBuffer, audioContext);  // Creates second node
```

### Pattern 4: CSP Directive for Media Sources
**What:** Add `media-src ${webview.cspSource}` to CSP meta tag to permit audio loading from webview URIs.
**When to use:** All webviews that load audio/video
**Example:**
```typescript
// Source: VS Code Webview API Documentation
// https://code.visualstudio.com/api/extension-guides/webview

panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      script-src 'unsafe-inline' ${panel.webview.cspSource};
      img-src ${panel.webview.cspSource};
      font-src ${panel.webview.cspSource};
      media-src ${panel.webview.cspSource};
    " />
  </head>
  <body>...</body>
</html>`;
```

### Pattern 5: Build-Time FFmpeg Conversion
**What:** Pre-convert audio assets to OGG Vorbis at build time using ffmpeg `libvorbis` codec.
**When to use:** Pre-build step for all audio assets before bundling
**Example:**
```bash
# Source: FFmpeg Audio Conversion Guide
# https://blog.fileformat.com/audio/how-to-create-ogg-file-using-ffmpeg/

# Convert MP3 to OGG Vorbis with quality level 4 (0-10 scale)
ffmpeg -i notification.mp3 -c:a libvorbis -q:a 4 notification.ogg

# Convert WAV to OGG Vorbis
ffmpeg -i door_open.wav -c:a libvorbis -q:a 4 door_open.ogg

# Batch convert all MP3 files in a directory
for file in sounds/*.mp3; do
  ffmpeg -i "$file" -c:a libvorbis -q:a 4 "${file%.mp3}.ogg"
done
```

### Anti-Patterns to Avoid
- **Creating AudioContext at module load time:** Autoplay policy will suspend the context; always create after user interaction
- **Reusing AudioBufferSourceNode:** Nodes can only call `start()` once; create a new node for each playback
- **Not catching decodeAudioData errors:** Codec failures will throw DOMException "EncodingError"; wrap in try/catch for graceful degradation
- **Using MP3 without fallback:** VS Code builds without ffmpeg proprietary codecs will fail to decode MP3; use OGG Vorbis or WAV
- **Blocking on audio loading:** Use async/await with try/catch, never block extension activation or rendering on audio availability

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio decoding from file formats | Custom MP3/OGG/WAV parser and decoder | `AudioContext.decodeAudioData()` | Browser-native decoder handles codec variations, sample rate conversion, channel mapping, and edge cases (corrupt files, partial data); custom decoders are 1000s of lines of complex DSP code |
| Audio playback timing and scheduling | setTimeout/setInterval for sound timing | Web Audio API node graph and `AudioContext.currentTime` | Web Audio API provides sample-accurate timing (microsecond precision); setTimeout has ~4ms jitter and is not audio-rate |
| Polyfilling AudioContext autoplay | Custom user interaction detection and queueing | Browser's built-in autoplay policy with `audioContext.resume()` | Browsers enforce autoplay policy at a lower level; custom queueing won't bypass policy and adds complexity |
| Audio format conversion at runtime | JavaScript audio transcoding (e.g., MP3 to WAV in browser) | Build-time ffmpeg conversion | Runtime transcoding is slow (100ms+ per file), increases bundle size (codec libraries are large), and wastes CPU; ffmpeg at build time is near-instant and produces optimized files |

**Key insight:** Web Audio API is a mature, battle-tested standard with excellent browser support (since 2013). The API surface is large, but for simple one-shot sound effects, the required subset is small: AudioContext, decodeAudioData, createBufferSource, connect, start. Custom audio code is almost always a mistake—use the browser's built-in capabilities.

## Common Pitfalls

### Pitfall 1: AudioContext Suspended on Creation
**What goes wrong:** AudioContext is created at module load time, audio plays after user interaction, but no sound is heard.
**Why it happens:** Browser autoplay policy creates AudioContext in "suspended" state if created before user gesture; `start()` is called but context remains suspended.
**How to avoid:** Always check `audioContext.state` and call `resume()` inside a user event handler (click, keypress, touch).
**Warning signs:** Audio works in some browsers but not others; audio works after second interaction but not first.

### Pitfall 2: DOMException "EncodingError" Crashes Extension
**What goes wrong:** `decodeAudioData()` throws DOMException when codec is unavailable (e.g., MP3 in VS Code without ffmpeg), error propagates to top level and breaks extension.
**Why it happens:** `decodeAudioData()` is async and returns a rejected promise; without `.catch()` or try/catch, unhandled rejection crashes execution context.
**How to avoid:** Wrap all `decodeAudioData()` calls in try/catch; log warning but continue execution; silent fallback is acceptable.
**Warning signs:** Extension works locally but crashes in CI or for some users; error message "Unable to decode audio data" in console.

### Pitfall 3: Missing CSP `media-src` Directive
**What goes wrong:** Audio files fail to load with CSP violation error in console; `fetch()` returns 401 or CSP block message.
**Why it happens:** VS Code webview has strict CSP by default; `media-src` directive is required to load audio files from webview URIs.
**How to avoid:** Add `media-src ${webview.cspSource};` to CSP meta tag in webview HTML.
**Warning signs:** Console error "Refused to load media from ... because it violates the following Content Security Policy directive: 'default-src 'none''".

### Pitfall 4: Reusing AudioBufferSourceNode
**What goes wrong:** Sound plays first time, then fails silently on subsequent plays; console error "Cannot call start more than once".
**Why it happens:** AudioBufferSourceNode can only call `start()` once; second call throws error and node is unusable.
**How to avoid:** Create a new AudioBufferSourceNode for each playback; nodes are cheap (just pointers to the AudioBuffer).
**Warning signs:** Sound effect works once, then stops working; error "InvalidStateError: An attempt was made to use an object that is not, or is no longer, usable".

### Pitfall 5: Not Handling ArrayBuffer Transfer Issues
**What goes wrong:** Audio files fetched via `asWebviewUri()` return empty or malformed ArrayBuffer; `decodeAudioData()` fails with "buffer is null" or "buffer underflow".
**Why it happens:** VS Code has known issues with ArrayBuffer transfer between extension host and webview (issue #115807); some VS Code versions serialize ArrayBuffer as plain object.
**How to avoid:** Fetch audio files directly in webview context (not via message passing from extension); verify `arrayBuffer.byteLength > 0` before decoding.
**Warning signs:** Audio works in local development but fails in packaged extension; ArrayBuffer appears as `{}` object instead of binary data.

## Code Examples

Verified patterns from official sources:

### Complete Audio Manager Module
```typescript
// Source: Synthesized from MDN Web Audio API Best Practices and VS Code Webview API
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
// https://code.visualstudio.com/api/extension-guides/webview

export class AudioManager {
  private context: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private initialized = false;

  /**
   * Initialize AudioContext after user gesture (autoplay policy requirement)
   * Call from click/keypress event handler
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.initialized = true;
    console.log('AudioContext initialized, state:', this.context.state);
  }

  /**
   * Load and decode audio file from webview URI
   * Returns null if codec unavailable (silent fallback)
   */
  async loadSound(uri: string): Promise<AudioBuffer | null> {
    if (!this.context) {
      console.warn('AudioContext not initialized, skipping audio load');
      return null;
    }

    if (this.cache.has(uri)) {
      return this.cache.get(uri)!;
    }

    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty audio file');
      }

      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.cache.set(uri, audioBuffer);
      console.log(`Loaded audio: ${uri} (${audioBuffer.duration.toFixed(2)}s)`);
      return audioBuffer;
    } catch (error) {
      console.warn(`Audio loading failed for ${uri}, continuing silently:`, error);
      return null;  // Silent fallback per AUDIO-04
    }
  }

  /**
   * Play sound effect (one-shot, creates new source node per play)
   */
  play(audioBuffer: AudioBuffer | null): void {
    if (!audioBuffer || !this.context || this.context.state !== 'running') {
      return;  // Silent fallback
    }

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);
    source.start(0);
  }
}
```

### Usage in Webview
```typescript
// Source: Pattern synthesized from Web Audio API documentation
// Initialize audio manager and attach to user gesture
const audioManager = new AudioManager();
let notificationSound: AudioBuffer | null = null;

// Attach to first canvas interaction
canvas.addEventListener('click', async () => {
  if (!audioManager.initialized) {
    await audioManager.init();

    // Load sounds after AudioContext is ready
    const soundUri = (window as any).ASSET_URIS.notificationSound;
    notificationSound = await audioManager.loadSound(soundUri);
  }
}, { once: true });

// Play sound on agent event
function onAgentSpawn() {
  audioManager.play(notificationSound);
}
```

### Extension Host: Generate Audio URIs
```typescript
// Source: VS Code Webview API Documentation
// https://code.visualstudio.com/api/extension-guides/webview

// In extension.ts
const notificationSoundUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'sounds', 'notification.ogg')
);

panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      script-src 'unsafe-inline' ${panel.webview.cspSource};
      img-src ${panel.webview.cspSource};
      font-src ${panel.webview.cspSource};
      media-src ${panel.webview.cspSource};
    " />
    <script>
      window.ASSET_URIS = {
        notificationSound: '${notificationSoundUri}'
      };
    </script>
  </head>
  <body>...</body>
</html>`;
```

### Build Script: Convert Audio to OGG Vorbis
```bash
# Source: FFmpeg Audio Conversion Guide
# https://blog.fileformat.com/audio/how-to-create-ogg-file-using-ffmpeg/

#!/bin/bash
# scripts/convert-audio-to-ogg.sh

INPUT_DIR="assets/sounds-source"
OUTPUT_DIR="dist/webview-assets/sounds"

mkdir -p "$OUTPUT_DIR"

for file in "$INPUT_DIR"/*.{mp3,wav,m4a}; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    name="${filename%.*}"

    echo "Converting $filename to OGG Vorbis..."
    ffmpeg -i "$file" -c:a libvorbis -q:a 4 "$OUTPUT_DIR/${name}.ogg" -y
  fi
done

echo "Audio conversion complete"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML `<audio>` element | Web Audio API for game audio | ~2013 (Web Audio API standardized) | Web Audio API provides sample-accurate timing, low latency, and programmatic control; `<audio>` element still used for background music but not sound effects |
| Callback-based decodeAudioData | Promise-based decodeAudioData | ~2015 (Promise support added) | Modern code uses async/await with decodeAudioData; callback syntax still supported for legacy compatibility |
| MP3 as universal format | OGG Vorbis or AAC depending on platform | ~2017 (codec wars settled) | MP3 requires licensing fees and may be absent in open-source builds; OGG Vorbis (open) or AAC (Apple ecosystem) preferred |
| Manual autoplay detection | Browser autoplay policy enforcement | ~2018 (Chrome autoplay policy) | Browsers now enforce autoplay blocking at API level; AudioContext created before user gesture is suspended |

**Deprecated/outdated:**
- `webkitAudioContext`: Deprecated vendor-prefixed constructor; use `AudioContext` (supported in all modern browsers since 2013)
- `createScriptProcessor()`: Deprecated in favor of `AudioWorklet` for custom audio processing; not relevant for simple sound playback
- Synchronous `decodeAudioData()` callback-only syntax: Still works but promise-based approach is standard

## Open Questions

1. **Which Habbo Hotel v14 sound effects are in scope?**
   - What we know: Requirements mention "authentic Habbo Hotel classic sound effects" to replace "flat notification chimes"
   - What's unclear: Specific sound effects to implement (door open, footstep, notification, bubble pop, etc.); source for authentic v14 SWF audio extraction
   - Recommendation: Clarify with user which 3-5 core sound effects are needed for v1; defer full sound catalog to v2; extract from Habbo v14 SWF or use community-sourced sound packs (e.g., HabboxWiki SFX archives, 101soundboards Habbo collection)

2. **Should audio playback be user-configurable (volume, mute)?**
   - What we know: AUDIO-04 requires silent fallback if codec unavailable
   - What's unclear: Should user be able to mute/adjust volume even when audio works?
   - Recommendation: Defer to Phase 6 UI Overlays or post-v1; start with fixed volume (0.5 gain) and no UI controls; add settings panel in v2 if requested

3. **How to handle audio loading failure in VS Code versions without OGG Vorbis support?**
   - What we know: VS Code issue #180780 confirms OGG Vorbis is supported; some older Electron builds may lack codec
   - What's unclear: Should we provide a WAV fallback in addition to OGG? Or only OGG with silent fallback?
   - Recommendation: Start with OGG Vorbis only; silent fallback per AUDIO-04; if field reports show codec failures, add WAV fallback in patch release

## Validation Architecture

> Nyquist validation is enabled in .planning/config.json

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- tests/isoAudioManager.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | OGG Vorbis files present in dist/webview-assets/sounds/ after build | smoke | Manual: verify `ls dist/webview-assets/sounds/*.ogg` | ❌ Wave 0 |
| AUDIO-02 | AudioManager.loadSound() fetches URI and calls decodeAudioData() | unit | `npm test -- tests/isoAudioManager.test.ts -t "loadSound"` | ❌ Wave 0 |
| AUDIO-03 | AudioContext created in suspended state, resume() called after init() | unit | `npm test -- tests/isoAudioManager.test.ts -t "init"` | ❌ Wave 0 |
| AUDIO-04 | decodeAudioData() error caught, null returned, no exception thrown | unit | `npm test -- tests/isoAudioManager.test.ts -t "silent fallback"` | ❌ Wave 0 |
| AUDIO-05 | CSP meta tag includes media-src directive | manual-only | Visual inspection of extension.ts HTML template | ✅ (manual verification only) |

### Sampling Rate
- **Per task commit:** `npm test -- tests/isoAudioManager.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual CSP verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/isoAudioManager.test.ts` — covers AUDIO-02, AUDIO-03, AUDIO-04
- [ ] `tests/setup.ts` — add AudioContext mock (happy-dom does not provide AudioContext by default)
- [ ] `scripts/convert-audio-to-ogg.sh` — build-time ffmpeg conversion script
- [ ] `dist/webview-assets/sounds/` — directory for OGG Vorbis files
- [ ] Update `package.json` scripts — add `prebuild` hook to run audio conversion script

## Sources

### Primary (HIGH confidence)
- [VS Code Webview API Documentation](https://code.visualstudio.com/api/extension-guides/webview) - CSP requirements, asWebviewUri() pattern, localResourceRoots
- [VS Code Issue #180780: Test ffmpeg codec support](https://github.com/microsoft/vscode/issues/180780) - Confirmed OGG Vorbis, WAV, FLAC support; MP3/AAC unsupported
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - AudioContext, decodeAudioData, AudioBufferSourceNode
- [MDN BaseAudioContext.decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) - API signature, error handling, promise pattern
- [MDN Autoplay Policy](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) - User gesture requirements, AudioContext.resume() pattern
- [MDN Content-Security-Policy: media-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/media-src) - CSP directive for audio/video sources

### Secondary (MEDIUM confidence)
- [Can I use: Web Audio API](https://caniuse.com/audio-api) - Browser support: 97% global, all modern browsers since 2013
- [Can I use: OGG Vorbis](https://caniuse.com/ogg-vorbis) - Browser support: 88% global, Chrome/Firefox/Edge full support, Safari 18.5+
- [FFmpeg OGG Vorbis Conversion Guide](https://blog.fileformat.com/audio/how-to-create-ogg-file-using-ffmpeg/) - libvorbis codec, quality levels
- [Chrome Autoplay Policy Blog](https://developer.chrome.com/blog/autoplay) - Autoplay policy enforcement, user gesture requirements
- [VS Code Issue #148494: decodeAudioData DOMException](https://github.com/microsoft/vscode/issues/148494) - Real-world codec failure examples in VS Code webviews

### Tertiary (LOW confidence)
- [Habbo Soundboard](https://www.101soundboards.com/boards/172347-habbo-soundboard) - Community-sourced Habbo sound effects (authenticity not verified)
- [HabboxWiki SFX](https://habboxwiki.com/SFX) - Habbo sound effects documentation (v14-specific availability unclear)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Web Audio API is mature, well-documented, and confirmed working in VS Code webviews by official tests
- Architecture: HIGH - Patterns verified from MDN official docs and VS Code API documentation; OGG Vorbis support confirmed by VS Code issue tracker
- Pitfalls: HIGH - Autoplay policy, CSP requirements, and codec failures are well-documented and confirmed by multiple official sources

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days — Web Audio API is stable, VS Code codec support unlikely to change)