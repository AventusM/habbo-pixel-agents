/**
 * AudioManager - Web Audio API wrapper with lazy initialization and graceful fallback
 * Phase 8 - Audio System
 *
 * Handles:
 * - Lazy AudioContext creation (after user gesture per autoplay policy)
 * - Audio file loading with silent codec failure handling
 * - One-shot sound playback
 */

export class AudioManager {
  private context: AudioContext | null = null;
  private cache: Map<string, AudioBuffer> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize AudioContext (must be called after user gesture)
   * Idempotent - safe to call multiple times
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create AudioContext if not exists
    if (!this.context) {
      this.context = new AudioContext();
    }

    // Resume if suspended (autoplay policy)
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.initialized = true;
    console.log(`AudioContext initialized, state: ${this.context.state}`);
  }

  /**
   * Load and decode audio file
   * Returns null on any error (codec unavailable, network failure, etc.)
   * Caches successfully decoded buffers
   *
   * @param uri - Audio file URI (from extension.ts asWebviewUri)
   * @returns AudioBuffer or null (silent fallback)
   */
  async loadSound(uri: string): Promise<AudioBuffer | null> {
    // Silent fallback if not initialized
    if (!this.context || !this.initialized) {
      return null;
    }

    // Return cached buffer if exists
    if (this.cache.has(uri)) {
      return this.cache.get(uri)!;
    }

    try {
      // Fetch audio file
      const response = await fetch(uri);
      if (!response.ok) {
        console.warn(`Audio fetch failed for ${uri}: ${response.status} ${response.statusText}, continuing silently`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();

      // Validate non-empty buffer
      if (arrayBuffer.byteLength === 0) {
        console.warn(`Audio file is empty for ${uri}, continuing silently`);
        return null;
      }

      // Decode audio data (may fail if codec unavailable)
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      // Cache and return
      this.cache.set(uri, audioBuffer);
      console.log(`Audio loaded successfully: ${uri} (${audioBuffer.duration.toFixed(2)}s)`);
      return audioBuffer;
    } catch (error) {
      // Silent fallback per AUDIO-04 - codec failure should not crash extension
      console.warn(`Audio loading failed for ${uri}, continuing silently:`, error);
      return null;
    }
  }

  /**
   * Play audio buffer (one-shot, no looping)
   * Returns early if buffer is null or context not ready
   *
   * @param audioBuffer - AudioBuffer from loadSound() (or null)
   */
  play(audioBuffer: AudioBuffer | null): void {
    // Silent fallback
    if (!audioBuffer || !this.context || this.context.state !== 'running') {
      return;
    }

    try {
      // Create new source node (one-shot playback)
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.context.destination);
      source.start(0);
    } catch (error) {
      console.warn('Audio playback failed, continuing silently:', error);
    }
  }
}
