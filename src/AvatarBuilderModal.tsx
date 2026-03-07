// src/AvatarBuilderModal.tsx
// React modal component for customizing avatar clothing, colors, and wardrobe presets.
// Rendered as an overlay above the room canvas.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OutfitConfig, CatalogItem } from './avatarOutfitConfig.js';
import {
  FIGURE_CATALOG,
  SKIN_PALETTE,
  HAIR_PALETTE,
  CLOTHING_PALETTE,
  getCatalogForSlot,
  getRequiredAssets,
} from './avatarOutfitConfig.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { renderAvatarPreview, PREVIEW_WIDTH, PREVIEW_HEIGHT } from './avatarBuilderPreview.js';

interface AvatarBuilderModalProps {
  avatarId: string;
  initialOutfit: OutfitConfig;
  variant: number;
  onSave: (outfit: OutfitConfig) => void;
  onClose: () => void;
  wardrobePresets?: OutfitConfig[];
  onSaveWardrobe?: (presets: OutfitConfig[]) => void;
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

export function AvatarBuilderModal({
  avatarId,
  initialOutfit,
  variant,
  onSave,
  onClose,
  wardrobePresets: initialWardrobe,
  onSaveWardrobe,
}: AvatarBuilderModalProps) {
  const [currentOutfit, setCurrentOutfit] = useState<OutfitConfig>(() =>
    JSON.parse(JSON.stringify(initialOutfit))
  );
  const [selectedCategory, setSelectedCategory] = useState<Category>('hair');
  const [gender, setGender] = useState<'M' | 'F'>(initialOutfit.gender);
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
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Click on backdrop closes modal
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 500,
          maxHeight: 480,
          backgroundColor: '#1a1a2e',
          borderRadius: 8,
          border: '1px solid #333',
          color: '#e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid #333',
          backgroundColor: '#16213e',
        }}>
          <span style={{ fontSize: 10, fontWeight: 'bold' }}>Avatar Builder</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 6px',
            }}
          >
            X
          </button>
        </div>

        {/* Main content area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Preview */}
          <div style={{
            width: PREVIEW_WIDTH + 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
            borderRight: '1px solid #333',
            backgroundColor: '#0f3460',
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
                bottom: 16,
                fontSize: 7,
                color: '#aaa',
              }}>
                Loading...
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 10,
            gap: 8,
            overflowY: 'auto',
          }}>
            {/* Gender toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['M', 'F'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => handleGenderChange(g)}
                  style={{
                    padding: '4px 12px',
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

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 7,
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
              gap: 3,
              maxHeight: 120,
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
                      fontSize: 6,
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
                      padding: 2,
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
              <div style={{ marginBottom: 3, fontSize: 7, color: '#aaa' }}>Skin</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {SKIN_PALETTE.map(color => (
                  <button
                    key={`skin-${color}`}
                    onClick={() => handleColorChange('skin', color)}
                    style={{
                      width: 20,
                      height: 20,
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
              <div style={{ marginBottom: 3, fontSize: 7, color: '#aaa' }}>
                {CATEGORY_LABELS[selectedCategory]} Color
              </div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {categoryPalette.map(color => (
                  <button
                    key={`${selectedCategory}-${color}`}
                    onClick={() => handleColorChange(colorKey, color)}
                    style={{
                      width: 20,
                      height: 20,
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
          </div>
        </div>

        {/* Footer: Wardrobe + Save/Cancel */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 14px',
          borderTop: '1px solid #333',
          backgroundColor: '#16213e',
        }}>
          {/* Wardrobe slots */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 7, color: '#aaa', marginRight: 4 }}>Wardrobe:</span>
            {wardrobeSlots.map((_, index) => (
              <button
                key={`wardrobe-${index}`}
                onClick={() => handleWardrobeLoad(index)}
                style={{
                  width: 24,
                  height: 24,
                  fontSize: 7,
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
            {wardrobeSlots.length < MAX_WARDROBE_SLOTS && (
              <button
                onClick={handleWardrobeSave}
                style={{
                  padding: '4px 8px',
                  fontSize: 7,
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: '#2a2a4a',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                +Save
              </button>
            )}
            {wardrobeSlots.length >= MAX_WARDROBE_SLOTS && (
              <button
                onClick={handleWardrobeSave}
                style={{
                  padding: '4px 8px',
                  fontSize: 7,
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: '#2a2a4a',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            )}
          </div>

          {/* Save/Cancel buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onSave(currentOutfit)}
              style={{
                padding: '6px 16px',
                fontSize: 8,
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: '#0066cc',
                color: '#fff',
                border: '1px solid #4488ee',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px 16px',
                fontSize: 8,
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: '#333',
                color: '#e0e0e0',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
