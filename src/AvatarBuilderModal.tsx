// src/AvatarBuilderModal.tsx
// React inline panel component for customizing avatar clothing, colors, and wardrobe presets.
// Rendered as a compact panel at bottom-left of the room canvas (not a modal overlay).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OutfitConfig, CatalogItem } from './avatarOutfitConfig.js';
import {
  FIGURE_CATALOG,
  SKIN_PALETTE,
  HAIR_PALETTE,
  CLOTHING_PALETTE,
  getCatalogForSlot,
  getRequiredAssets,
  ROLE_OUTFIT_PRESETS,
} from './avatarOutfitConfig.js';
import type { TeamSection } from './agentTypes.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { renderAvatarPreview, PREVIEW_WIDTH, PREVIEW_HEIGHT } from './avatarBuilderPreview.js';

interface AvatarBuilderPanelProps {
  avatarId: string;
  initialOutfit: OutfitConfig;
  variant: number;
  onSave: (outfit: OutfitConfig) => void;
  onClose: () => void;
  wardrobePresets?: OutfitConfig[];
  onSaveWardrobe?: (presets: OutfitConfig[]) => void;
  avatarTeam?: TeamSection;
}

type Category = 'hair' | 'tops' | 'bottoms' | 'shoes' | 'accessories';

const CATEGORIES: Category[] = ['hair', 'tops', 'bottoms', 'shoes', 'accessories'];

const CATEGORY_LABELS: Record<Category, string> = {
  hair: 'Hair',
  tops: 'Tops',
  bottoms: 'Bottoms',
  shoes: 'Shoes',
  accessories: 'Accessories',
};

/** Map category to the OutfitConfig.parts key it modifies */
const CATEGORY_PART_KEY: Record<Category, keyof OutfitConfig['parts'] | null> = {
  hair: 'hair',
  tops: 'shirt',
  bottoms: 'pants',
  shoes: 'shoes',
  accessories: 'hair', // accessories replace hair slot (hats)
};

/** Map category to the OutfitConfig.colors key for the palette */
const CATEGORY_COLOR_KEY: Record<Category, keyof OutfitConfig['colors']> = {
  hair: 'hair',
  tops: 'shirt',
  bottoms: 'pants',
  shoes: 'shoes',
  accessories: 'hair',
};

const MAX_WARDROBE_SLOTS = 4;

/** Team display names and colors for Role Outfits tab */
const TEAM_DISPLAY: Record<TeamSection, { label: string; color: string }> = {
  'planning': { label: 'Planning', color: '#3B5998' },
  'core-dev': { label: 'Core Dev', color: '#5BD55B' },
  'infrastructure': { label: 'Infra', color: '#D4A017' },
  'support': { label: 'Support', color: '#9B5BD5' },
};

const ALL_TEAMS: TeamSection[] = ['planning', 'core-dev', 'infrastructure', 'support'];

type TabMode = 'clothing' | 'roles';

export function AvatarBuilderPanel({
  avatarId,
  initialOutfit,
  variant,
  onSave,
  onClose,
  wardrobePresets: initialWardrobe,
  onSaveWardrobe,
  avatarTeam,
}: AvatarBuilderPanelProps) {
  const [currentOutfit, setCurrentOutfit] = useState<OutfitConfig>(() =>
    JSON.parse(JSON.stringify(initialOutfit))
  );
  const [selectedCategory, setSelectedCategory] = useState<Category>('hair');
  const [gender, setGender] = useState<'M' | 'F'>(initialOutfit.gender);
  const [tabMode, setTabMode] = useState<TabMode>('clothing');
  const [wardrobeSlots, setWardrobeSlots] = useState<OutfitConfig[]>(
    initialWardrobe ? [...initialWardrobe] : []
  );
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load required assets when outfit changes
  const loadAssetsIfNeeded = useCallback(async (outfit: OutfitConfig) => {
    const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
    if (!spriteCache) return;

    const requiredAssets = getRequiredAssets(outfit);
    const unloaded = requiredAssets.filter(name => !spriteCache.hasNitroAsset(name));
    if (unloaded.length === 0) return;

    setLoading(true);
    const { nitroFiguresBase } = (window as any).ASSET_URIS || {};
    if (!nitroFiguresBase) {
      setLoading(false);
      return;
    }

    for (const assetName of unloaded) {
      try {
        await spriteCache.loadNitroAsset(
          assetName,
          `${nitroFiguresBase}/${assetName}.png`,
          `${nitroFiguresBase}/${assetName}.json`
        );
      } catch (err) {
        console.warn(`Failed to load figure asset ${assetName}:`, err);
      }
    }
    setLoading(false);
  }, []);

  // Render preview whenever outfit changes
  useEffect(() => {
    const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
    if (!spriteCache || !canvasRef.current) return;

    // Load assets first, then render
    loadAssetsIfNeeded(currentOutfit).then(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        renderAvatarPreview(ctx, currentOutfit, spriteCache, variant);
      }
    });
  }, [currentOutfit, variant, loadAssetsIfNeeded]);

  // Handle gender toggle
  const handleGenderChange = (newGender: 'M' | 'F') => {
    if (newGender === gender) return;
    setGender(newGender);

    const updated: OutfitConfig = { ...currentOutfit, gender: newGender };

    // Check if current selections are compatible with new gender
    for (const cat of CATEGORIES) {
      const partKey = CATEGORY_PART_KEY[cat];
      if (!partKey) continue;

      const items = getCatalogForSlot(cat, newGender);
      const currentPart = updated.parts[partKey];
      const isCompatible = items.some(
        item => item.asset === currentPart.asset && item.setId === currentPart.setId
      );

      if (!isCompatible && items.length > 0) {
        updated.parts = {
          ...updated.parts,
          [partKey]: { asset: items[0].asset, setId: items[0].setId },
        };
      }
    }

    setCurrentOutfit(updated);
  };

  // Handle catalog item selection
  const handleItemSelect = (item: CatalogItem) => {
    const partKey = CATEGORY_PART_KEY[selectedCategory];
    if (!partKey) return;

    setCurrentOutfit(prev => ({
      ...prev,
      parts: {
        ...prev.parts,
        [partKey]: { asset: item.asset, setId: item.setId },
      },
    }));
  };

  // Handle color swatch selection
  const handleColorChange = (colorKey: keyof OutfitConfig['colors'], color: string) => {
    setCurrentOutfit(prev => ({
      ...prev,
      colors: { ...prev.colors, [colorKey]: color },
    }));
  };

  // Save current outfit to wardrobe slot
  const handleWardrobeSave = () => {
    const copy: OutfitConfig = JSON.parse(JSON.stringify(currentOutfit));
    setWardrobeSlots(prev => {
      const updated = prev.length >= MAX_WARDROBE_SLOTS
        ? [...prev.slice(0, MAX_WARDROBE_SLOTS - 1), copy]
        : [...prev, copy];
      onSaveWardrobe?.(updated);
      return updated;
    });
  };

  // Load outfit from wardrobe slot
  const handleWardrobeLoad = (index: number) => {
    const preset = wardrobeSlots[index];
    if (!preset) return;
    setCurrentOutfit(JSON.parse(JSON.stringify(preset)));
    setGender(preset.gender);
  };

  // Apply a role outfit preset
  const handleApplyRolePreset = (team: TeamSection) => {
    const preset: OutfitConfig = JSON.parse(JSON.stringify(ROLE_OUTFIT_PRESETS[team]));
    // Preserve current skin color for continuity
    preset.colors.skin = currentOutfit.colors.skin;
    setCurrentOutfit(preset);
    setGender(preset.gender);
  };

  // Reset to the assigned team's default preset
  const handleResetToRoleDefault = () => {
    if (!avatarTeam) return;
    const preset: OutfitConfig = JSON.parse(JSON.stringify(ROLE_OUTFIT_PRESETS[avatarTeam]));
    preset.colors.skin = currentOutfit.colors.skin;
    setCurrentOutfit(preset);
    setGender(preset.gender);
  };

  // Get filtered items for current category and gender
  const categoryItems = getCatalogForSlot(selectedCategory, gender);

  // Get the currently selected item for this category
  const partKey = CATEGORY_PART_KEY[selectedCategory];
  const currentPart = partKey ? currentOutfit.parts[partKey] : null;

  // Get the appropriate palette for color section
  const colorKey = CATEGORY_COLOR_KEY[selectedCategory];
  const categoryPalette = selectedCategory === 'hair' || selectedCategory === 'accessories'
    ? HAIR_PALETTE
    : CLOTHING_PALETTE;

  return (
    <div
      style={{
        position: 'absolute',
        left: '10px',
        bottom: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#e0e0e0',
        borderRadius: 4,
        border: '1px solid #333',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8,
        width: 220,
        maxHeight: 500,
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid #333',
        backgroundColor: '#16213e',
        borderRadius: '4px 4px 0 0',
      }}>
        <span style={{ fontSize: 8, fontWeight: 'bold' }}>Avatar Builder</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 4px',
          }}
        >
          X
        </button>
      </div>

      {/* Preview */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 8px',
        position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            imageRendering: 'pixelated',
            backgroundColor: '#0a1628',
            borderRadius: 4,
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            fontSize: 7,
            color: '#aaa',
          }}>
            Loading...
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 8px',
        gap: 6,
      }}>
        {/* Gender toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['M', 'F'] as const).map(g => (
            <button
              key={g}
              onClick={() => handleGenderChange(g)}
              style={{
                padding: '3px 10px',
                fontSize: 8,
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: gender === g ? '#0066cc' : '#2a2a4a',
                color: '#e0e0e0',
                border: gender === g ? '1px solid #4488ee' : '1px solid #444',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Main tab switcher: Clothing vs Role Outfits */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setTabMode('clothing')}
            style={{
              flex: 1,
              padding: '3px 5px',
              fontSize: 6,
              fontFamily: '"Press Start 2P", monospace',
              backgroundColor: tabMode === 'clothing' ? '#0066cc' : '#2a2a4a',
              color: '#e0e0e0',
              border: tabMode === 'clothing' ? '1px solid #4488ee' : '1px solid #444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Clothing
          </button>
          <button
            onClick={() => setTabMode('roles')}
            style={{
              flex: 1,
              padding: '3px 5px',
              fontSize: 6,
              fontFamily: '"Press Start 2P", monospace',
              backgroundColor: tabMode === 'roles' ? '#0066cc' : '#2a2a4a',
              color: '#e0e0e0',
              border: tabMode === 'roles' ? '1px solid #4488ee' : '1px solid #444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Role Outfits
          </button>
        </div>

        {tabMode === 'clothing' ? (
          <>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '3px 5px',
                    fontSize: 6,
                    fontFamily: '"Press Start 2P", monospace',
                    backgroundColor: selectedCategory === cat ? '#0066cc' : '#2a2a4a',
                    color: '#e0e0e0',
                    border: selectedCategory === cat ? '1px solid #4488ee' : '1px solid #444',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Icon grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 2,
              maxHeight: 100,
              overflowY: 'auto',
            }}>
              {categoryItems.map(item => {
                const isSelected = currentPart
                  && item.asset === currentPart.asset
                  && item.setId === currentPart.setId;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemSelect(item)}
                    title={item.displayName}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      fontSize: 5,
                      fontFamily: '"Press Start 2P", monospace',
                      backgroundColor: isSelected ? '#0066cc' : '#2a2a4a',
                      color: '#e0e0e0',
                      border: isSelected ? '2px solid #4488ee' : '1px solid #444',
                      borderRadius: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: 1,
                      lineHeight: '1.2',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.displayName}
                  </button>
                );
              })}
            </div>

            {/* Skin color palette */}
            <div>
              <div style={{ marginBottom: 2, fontSize: 6, color: '#aaa' }}>Skin</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {SKIN_PALETTE.map(color => (
                  <button
                    key={`skin-${color}`}
                    onClick={() => handleColorChange('skin', color)}
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: color,
                      border: currentOutfit.colors.skin === color
                        ? '2px solid #fff'
                        : '1px solid #555',
                      borderRadius: 2,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Category color palette */}
            <div>
              <div style={{ marginBottom: 2, fontSize: 6, color: '#aaa' }}>
                {CATEGORY_LABELS[selectedCategory]} Color
              </div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {categoryPalette.map(color => (
                  <button
                    key={`${selectedCategory}-${color}`}
                    onClick={() => handleColorChange(colorKey, color)}
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: color,
                      border: currentOutfit.colors[colorKey] === color
                        ? '2px solid #fff'
                        : '1px solid #555',
                      borderRadius: 2,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Role Outfits tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 6, color: '#aaa', marginBottom: 2 }}>
              Apply a team outfit preset:
            </div>
            {ALL_TEAMS.map(team => {
              const display = TEAM_DISPLAY[team];
              const isCurrentTeam = avatarTeam === team;
              return (
                <div
                  key={team}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    backgroundColor: isCurrentTeam ? 'rgba(255,255,255,0.08)' : '#1a1a2e',
                    border: isCurrentTeam ? `1px solid ${display.color}` : '1px solid #333',
                    borderRadius: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: display.color,
                    }} />
                    <span style={{ fontSize: 6 }}>
                      {display.label}
                      {isCurrentTeam && (
                        <span style={{ color: display.color, marginLeft: 4, fontSize: 5 }}>*</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleApplyRolePreset(team)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 5,
                      fontFamily: '"Press Start 2P", monospace',
                      backgroundColor: '#2a2a4a',
                      color: '#e0e0e0',
                      border: '1px solid #444',
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>
              );
            })}
            {avatarTeam && (
              <button
                onClick={handleResetToRoleDefault}
                style={{
                  padding: '4px 8px',
                  fontSize: 6,
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: '#2a2a4a',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: 3,
                  cursor: 'pointer',
                  marginTop: 2,
                }}
              >
                Reset to Role Default
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer: Wardrobe + Save/Cancel */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 8px',
        borderTop: '1px solid #333',
        backgroundColor: '#16213e',
        borderRadius: '0 0 4px 4px',
      }}>
        {/* Wardrobe slots */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 6, color: '#aaa', marginRight: 2 }}>Wardrobe:</span>
          {wardrobeSlots.map((_, index) => (
            <button
              key={`wardrobe-${index}`}
              onClick={() => handleWardrobeLoad(index)}
              style={{
                width: 20,
                height: 20,
                fontSize: 6,
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: '#2a2a4a',
                color: '#e0e0e0',
                border: '1px solid #444',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {index + 1}
            </button>
          ))}
          <button
            onClick={handleWardrobeSave}
            style={{
              padding: '3px 6px',
              fontSize: 6,
              fontFamily: '"Press Start 2P", monospace',
              backgroundColor: '#2a2a4a',
              color: '#e0e0e0',
              border: '1px solid #444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {wardrobeSlots.length >= MAX_WARDROBE_SLOTS ? 'Save' : '+Save'}
          </button>
        </div>

        {/* Save/Cancel buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onSave(currentOutfit)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: 7,
              fontFamily: '"Press Start 2P", monospace',
              backgroundColor: '#0066cc',
              color: '#fff',
              border: '1px solid #4488ee',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: 7,
              fontFamily: '"Press Start 2P", monospace',
              backgroundColor: '#333',
              color: '#e0e0e0',
              border: '1px solid #555',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export under old name for backward compatibility
export { AvatarBuilderPanel as AvatarBuilderModal };
