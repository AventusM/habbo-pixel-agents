// src/LayoutEditorPanel.tsx
// React UI component for layout editor controls

import React from 'react';
import type { EditorMode } from './isoLayoutEditor.js';
import type { HsbColor } from './isoTypes.js';
import { getCatalogByCategory, CATEGORY_LABELS } from './furnitureRegistry.js';

interface LayoutEditorPanelProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  selectedColor: HsbColor;
  onColorChange: (color: HsbColor) => void;
  selectedFurniture: string;
  onFurnitureChange: (furniture: string) => void;
  furnitureDirection: number;
  onRotate: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
}

const GROUPED_CATALOG = getCatalogByCategory();

export function LayoutEditorPanel({
  editorMode,
  onModeChange,
  selectedColor,
  onColorChange,
  selectedFurniture,
  onFurnitureChange,
  furnitureDirection,
  onRotate,
  onSave,
  onLoad,
}: LayoutEditorPanelProps) {
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
  };

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: '10px',
    top: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    minWidth: '150px',
    zIndex: 1000,
  };

  const buttonStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px',
    margin: '4px 0',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    backgroundColor: '#444',
    color: 'white',
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#0066cc',
    fontWeight: 'bold',
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    margin: '4px 0',
  };

  return (
    <div style={panelStyle}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Layout Editor</div>

      {/* Mode buttons */}
      <button
        style={editorMode === 'view' ? activeButtonStyle : buttonStyle}
        onClick={() => onModeChange('view')}
      >
        View
      </button>
      <button
        style={editorMode === 'paint' ? activeButtonStyle : buttonStyle}
        onClick={() => onModeChange('paint')}
      >
        Paint
      </button>
      <button
        style={editorMode === 'color' ? activeButtonStyle : buttonStyle}
        onClick={() => onModeChange('color')}
      >
        Color
      </button>
      <button
        style={editorMode === 'furniture' ? activeButtonStyle : buttonStyle}
        onClick={() => onModeChange('furniture')}
      >
        Furniture
      </button>

      {/* Color picker (visible when color mode) */}
      {editorMode === 'color' && (
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
          <div style={{ marginBottom: '4px' }}>Color Picker</div>
          <label style={{ display: 'block', fontSize: '10px' }}>
            H: {selectedColor.h}
            <input
              type="range"
              min="0"
              max="360"
              value={selectedColor.h}
              onChange={(e) => onColorChange({ ...selectedColor, h: parseInt(e.target.value) })}
              style={sliderStyle}
            />
          </label>
          <label style={{ display: 'block', fontSize: '10px' }}>
            S: {selectedColor.s}%
            <input
              type="range"
              min="0"
              max="100"
              value={selectedColor.s}
              onChange={(e) => onColorChange({ ...selectedColor, s: parseInt(e.target.value) })}
              style={sliderStyle}
            />
          </label>
          <label style={{ display: 'block', fontSize: '10px' }}>
            B: {selectedColor.b}%
            <input
              type="range"
              min="0"
              max="100"
              value={selectedColor.b}
              onChange={(e) => onColorChange({ ...selectedColor, b: parseInt(e.target.value) })}
              style={sliderStyle}
            />
          </label>
          <div
            style={{
              width: '100%',
              height: '20px',
              marginTop: '4px',
              backgroundColor: `hsl(${selectedColor.h}, ${selectedColor.s}%, ${selectedColor.b}%)`,
              border: '1px solid white',
            }}
          />
        </div>
      )}

      {/* Furniture selector (visible when furniture mode) */}
      {editorMode === 'furniture' && (
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
          <div style={{ marginBottom: '4px' }}>Furniture</div>
          <select
            value={selectedFurniture}
            onChange={(e) => onFurnitureChange(e.target.value)}
            style={{ width: '100%', padding: '4px', marginBottom: '4px' }}
          >
            {Array.from(GROUPED_CATALOG.entries()).map(([category, entries]) => (
              <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button onClick={onRotate} style={buttonStyle}>
            Rotate (dir: {furnitureDirection})
          </button>
        </div>
      )}

      {/* Save/Load buttons */}
      <div style={{ marginTop: '10px', borderTop: '1px solid #666', paddingTop: '8px' }}>
        <button onClick={onSave} style={buttonStyle}>
          Save Layout
        </button>
        <label style={{ ...buttonStyle, textAlign: 'center' }}>
          Load Layout
          <input
            type="file"
            accept=".json"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  );
}
