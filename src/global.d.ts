// src/global.d.ts
// Global type declarations for window properties

declare global {
  interface Window {
    /** Debug tracking for furniture types that have been logged */
    _debuggedFurniture?: Set<string>;
/** Asset URIs passed from extension host to webview */
    ASSET_URIS?: {
      furniturePng: string;
      furnitureJson: string;
      avatarPng?: string;
      avatarJson?: string;
      nitroManifest?: string;
      nitroFurnitureBase?: string;
      nitroFiguresBase?: string;
    };
  }
}

export {};
