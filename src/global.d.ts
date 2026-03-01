// src/global.d.ts
// Global type declarations for window properties

declare global {
  interface Window {
    /** Debug tracking for furniture types that have been logged */
    _debuggedFurniture?: Set<string>;
    /** Debug tracking for avatar IDs that have been logged */
    _debuggedAvatars?: Set<string>;
    /** Asset URIs passed from extension host to webview */
    ASSET_URIS?: {
      furniturePng: string;
      furnitureJson: string;
      avatarPng?: string;
      avatarJson?: string;
    };
  }
}

export {};
