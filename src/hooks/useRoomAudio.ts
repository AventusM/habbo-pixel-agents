// src/hooks/useRoomAudio.ts
// Audio manager lifecycle + sound playback (M008/S01, extracted from RoomCanvas).
// Audio readiness is a uiStore value (M008/S03): the store is the single source
// of truth, written once initialization succeeds and read back via useStoreValue.
// managerRef/buffersRef stay imperative audio resources, not mirrored state.
import { useRef } from 'react';
import { AudioManager } from '../isoAudioManager.js';
import { uiStore, selectAudioReady } from '../state/uiStore.js';
import { useStoreValue } from './useStoreValue.js';

const AVAILABLE_SOUNDS = ['notification'];

export function useRoomAudio() {
  const managerRef = useRef<AudioManager | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const ready = useStoreValue(uiStore, selectAudioReady);

  const ensureInitialized = async () => {
    if (managerRef.current) return;
    managerRef.current = new AudioManager();
    await managerRef.current.init();
    const uris = (window as any).ASSET_URIS;
    if (uris?.notificationSound) {
      const buf = await managerRef.current.loadSound(uris.notificationSound);
      if (buf) buffersRef.current.set('notification', buf);
    }
    uiStore.setAudioReady(true);
  };

  const playSound = async (soundName: string) => {
    if (!managerRef.current) {
      await ensureInitialized();
    }
    let buf = buffersRef.current.get(soundName);
    if (!buf && managerRef.current) {
      const uris = (window as any).ASSET_URIS;
      const uriKey = soundName + 'Sound';
      if (uris?.[uriKey]) {
        const loaded = await managerRef.current.loadSound(uris[uriKey]);
        if (loaded) {
          buffersRef.current.set(soundName, loaded);
          buf = loaded;
        }
      }
    }
    if (buf && managerRef.current) {
      managerRef.current.play(buf);
    } else {
      console.warn(`Sound "${soundName}" not loaded`);
    }
  };

  return { ensureInitialized, playSound, availableSounds: AVAILABLE_SOUNDS, ready };
}
