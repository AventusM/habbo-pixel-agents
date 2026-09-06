// src/assetBootstrap.ts
// Shared asset bootstrap for BOTH hosts (standalone web app + VS Code
// extension webview). Loads core atlases, the character atlas, and Nitro
// furniture/figure assets; returns a report used for logging and for the
// degraded-state status chip. Replaces the duplicated per-host loader code.

import type { SpriteCache } from './isoSpriteCache.js';
import { reportDegradation, clearDegradation } from './degradations.js';

export interface AssetUris {
  chairPng: string;
  chairJson: string;
  furniturePng: string;
  furnitureJson: string;
  avatarPng?: string;
  avatarJson?: string;
  pixellabPng?: string;
  pixellabJson?: string;
  teamAtlases?: Array<{ name: string; png?: string; json?: string }>;
  nitroManifest?: string;
  nitroFurnitureBase?: string;
  nitroFigureBase?: string;
}

export interface NitroLoadStats {
  loaded: number;
  total: number;
}

export interface BootstrapReport {
  atlases: Record<string, 'ok' | 'skipped' | 'failed'>;
  nitroFurniture: NitroLoadStats | null;
  nitroFigures: NitroLoadStats | null;
  nitroManifestOk: boolean;
  /** Figures fully loaded => the original Habbo figure renderer is usable */
  figuresAvailable: boolean;
  errors: string[];
}

export async function loadAllAssets(
  spriteCache: SpriteCache,
  uris: AssetUris,
): Promise<BootstrapReport> {
  const report: BootstrapReport = {
    atlases: {},
    nitroFurniture: null,
    nitroFigures: null,
    nitroManifestOk: false,
    figuresAvailable: false,
    errors: [],
  };

  type AtlasSpec = { name: string; png?: string; json?: string; required?: boolean };
  const atlases: AtlasSpec[] = [
    { name: 'chair', png: uris.chairPng, json: uris.chairJson, required: true },
    { name: 'furniture', png: uris.furniturePng, json: uris.furnitureJson, required: true },
    { name: 'avatar', png: uris.avatarPng, json: uris.avatarJson, required: true },
    { name: 'pixellab', png: uris.pixellabPng, json: uris.pixellabJson },
    ...(uris.teamAtlases ?? []),
  ];

  // Independent atlas loads run in parallel (first paint latency)
  await Promise.all(
    atlases.map(async (spec) => {
      if (!spec.png || !spec.json) {
        report.atlases[spec.name] = 'skipped';
        return;
      }
      try {
        await spriteCache.loadAtlas(spec.name, spec.png, spec.json);
        report.atlases[spec.name] = 'ok';
      } catch (err) {
        report.atlases[spec.name] = 'failed';
        const detail = `atlas ${spec.name}: ${err instanceof Error ? err.message : String(err)}`;
        report.errors.push(detail);
        reportDegradation(`atlas-${spec.name}`, detail);
        if (spec.required) console.warn(`⚠ Failed to load required atlas ${spec.name}:`, err);
        else console.warn(`⚠ Failed to load atlas ${spec.name}:`, err);
      }
    }),
  );

  // Nitro manifest -> furniture + figures (parallel per item)
  if (uris.nitroManifest) {
    try {
      const manifestRes = await fetch(uris.nitroManifest);
      if (!manifestRes.ok) throw new Error(`manifest fetch ${manifestRes.status}`);
      const manifest = (await manifestRes.json()) as {
        furniture?: string[];
        figures?: string[];
      };
      report.nitroManifestOk = true;
      clearDegradation('nitro-manifest');

      const loadNitroItems = async (
        names: string[],
        base: string,
        kind: 'furniture' | 'figures',
      ): Promise<NitroLoadStats> => {
        let loaded = 0;
        await Promise.all(
          names.map(async (name) => {
            try {
              await spriteCache.loadNitroAsset(name, `${base}/${name}.png`, `${base}/${name}.json`);
              loaded += 1;
            } catch (err) {
              const detail = `nitro ${kind} ${name}: ${err instanceof Error ? err.message : String(err)}`;
              report.errors.push(detail);
              console.warn(`⚠ Failed to load Nitro ${kind} ${name}:`, err);
            }
          }),
        );
        return { loaded, total: names.length };
      };

      if (manifest.furniture && uris.nitroFurnitureBase) {
        report.nitroFurniture = await loadNitroItems(
          manifest.furniture,
          uris.nitroFurnitureBase,
          'furniture',
        );
      }

      if (manifest.figures && uris.nitroFigureBase) {
        report.nitroFigures = await loadNitroItems(
          manifest.figures,
          uris.nitroFigureBase,
          'figures',
        );
        report.figuresAvailable =
          report.nitroFigures.loaded === report.nitroFigures.total &&
          spriteCache.hasNitroAsset('hh_human_body');
        if (report.figuresAvailable) clearDegradation('figures');
        else reportDegradation('figures', `figures incomplete: ${report.nitroFigures.loaded}/${report.nitroFigures.total}`);
      }
    } catch (err) {
      const detail = `nitro manifest: ${err instanceof Error ? err.message : String(err)}`;
      report.errors.push(detail);
      reportDegradation('nitro-manifest', detail);
      console.warn('⚠ Nitro assets unavailable, using placeholder sprites:', err);
    }
  }

  return report;
}
