// src/global.d.ts
// Global type declarations for window properties

declare global {
  interface Window {
    /** Debug tracking for furniture types that have been logged */
    _debuggedFurniture?: Set<string>;
    /** Console log buffer captured by the host entry for dev capture */
    __devLogBuffer?: string[];
    /** VS Code webview API bridge (absent in the standalone web build) */
    vscodeApi?: { postMessage: (message: unknown) => void };
/** Asset URIs passed from extension host to webview */
    ASSET_URIS?: {
      furniturePng: string;
      furnitureJson: string;
      avatarPng?: string;
      avatarJson?: string;
      nitroManifest?: string;
      nitroFurnitureBase?: string;
      nitroFigureBase?: string;
    };
  }
}

export {};
