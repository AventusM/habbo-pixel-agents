// src/LayoutEditorPanel.tsx
// Presentational room (layout) editor panel (M009/S01, D021 convention).
// A floating, collapsible dark-glass card matching the room HUD idiom (slate
// glass + monospace) so it works as an overlay in both the VS Code webview and
// the standalone web build. Props in, JSX out — the shell owns the editor state
// and every callback; the only local state is the dev sound selection (UI-only,
// exempt under D021). No host imports, no application logic.

import { useState, type CSSProperties, type ChangeEvent } from 'react';
import type { EditorMode, PlacedFurnitureInfo } from './isoLayoutEditor.js';
import type { HsbColor } from './isoTypes.js';
import { getCatalogByCategory, CATEGORY_LABELS } from './furnitureRegistry.js';

export interface LayoutEditorPanelProps {
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
  /** Collapse the panel (shell-owned open state). */
  onClose: () => void;
  /** Selected placed item — distinct from `selectedFurniture`, the type to place. */
  selectedPlacement?: PlacedFurnitureInfo | null;
  moveArmed?: boolean;
  onMoveSelected?: () => void;
  onDeleteSelected?: () => void;
  devMode?: boolean;
  onDevCapture?: () => void;
  onDebugGrid?: () => void;
  onPlaySound?: (soundName: string) => void;
  availableSounds?: string[];
  audioReady?: boolean;
}

const GROUPED_CATALOG = getCatalogByCategory();

const EDITOR_MODES: ReadonlyArray<{ mode: EditorMode; label: string }> = [
  { mode: 'view', label: 'View' },
  { mode: 'paint', label: 'Paint' },
  { mode: 'color', label: 'Color' },
  { mode: 'furniture', label: 'Furniture' },
];

// --- styles (module-level constants: no per-render allocation) ---

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 10,
  right: 10,
  zIndex: 1000,
  width: 236,
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  padding: 10,
  borderRadius: 8,
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  boxSizing: 'border-box',
  textAlign: 'left',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
  fontWeight: 'bold',
};

const closeButtonStyle: CSSProperties = {
  padding: '0 6px',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 4,
  background: 'transparent',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  cursor: 'pointer',
};

const modeRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
};

const buttonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px',
  margin: '4px 0',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  background: '#334155',
  color: '#e2e8f0',
  boxSizing: 'border-box',
};

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#0066cc',
  fontWeight: 'bold',
};

const sectionStyle: CSSProperties = {
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid rgba(148, 163, 184, 0.25)',
};

const sectionTitleStyle: CSSProperties = { marginBottom: 4, opacity: 0.85 };

const sliderLabelStyle: CSSProperties = { display: 'block', fontSize: 10 };

const sliderStyle: CSSProperties = { width: '100%', margin: '4px 0' };

const previewStyle: CSSProperties = {
  width: '100%',
  height: 20,
  marginTop: 4,
  border: '1px solid rgba(148, 163, 184, 0.35)',
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: 4,
  marginBottom: 4,
  boxSizing: 'border-box',
};

const fileLabelStyle: CSSProperties = {
  ...buttonStyle,
  textAlign: 'center',
};

const hiddenInputStyle: CSSProperties = { display: 'none' };

const selectedItemStyle: CSSProperties = {
  marginTop: 4,
  padding: '4px 6px',
  borderRadius: 4,
  background: 'rgba(0, 102, 204, 0.25)',
  border: '1px solid rgba(0, 255, 255, 0.5)',
};

const deleteButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#7f1d1d',
};

const hintStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  opacity: 0.75,
};

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
  onClose,
  selectedPlacement,
  moveArmed,
  onMoveSelected,
  onDeleteSelected,
  devMode,
  onDevCapture,
  onDebugGrid,
  onPlaySound,
  availableSounds,
  audioReady,
}: LayoutEditorPanelProps) {
  const [selectedSound, setSelectedSound] = useState(availableSounds?.[0] ?? '');

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
  };

  return (
    <div style={panelStyle} data-room-editor="true">
      <div style={headerStyle}>
        <span>Room Editor</span>
        <button
          type="button"
          style={closeButtonStyle}
          aria-label="Close room editor"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {/* Mode buttons */}
      <div style={modeRowStyle}>
        {EDITOR_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            style={editorMode === mode ? activeButtonStyle : buttonStyle}
            onClick={() => onModeChange(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Color picker (visible when color mode) */}
      {editorMode === 'color' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Color Picker</div>
          <label style={sliderLabelStyle}>
            H: {selectedColor.h}
            <input
              type="range"
              min="0"
              max="360"
              value={selectedColor.h}
              onChange={(e) => onColorChange({ ...selectedColor, h: parseInt(e.target.value, 10) })}
              style={sliderStyle}
            />
          </label>
          <label style={sliderLabelStyle}>
            S: {selectedColor.s}%
            <input
              type="range"
              min="0"
              max="100"
              value={selectedColor.s}
              onChange={(e) => onColorChange({ ...selectedColor, s: parseInt(e.target.value, 10) })}
              style={sliderStyle}
            />
          </label>
          <label style={sliderLabelStyle}>
            B: {selectedColor.b}%
            <input
              type="range"
              min="0"
              max="100"
              value={selectedColor.b}
              onChange={(e) => onColorChange({ ...selectedColor, b: parseInt(e.target.value, 10) })}
              style={sliderStyle}
            />
          </label>
          <div
            style={{
              ...previewStyle,
              backgroundColor: `hsl(${selectedColor.h}, ${selectedColor.s}%, ${selectedColor.b}%)`,
            }}
          />
        </div>
      )}

      {/* Furniture selector (visible when furniture mode) */}
      {editorMode === 'furniture' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Furniture</div>
          <select
            value={selectedFurniture}
            onChange={(e) => onFurnitureChange(e.target.value)}
            style={selectStyle}
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
          <button type="button" onClick={onRotate} style={buttonStyle}>
            Rotate (dir: {furnitureDirection})
          </button>
          {selectedPlacement ? (
            <>
              <div style={selectedItemStyle} data-selected-furniture="true">
                Selected: {selectedPlacement.name} @ ({selectedPlacement.tileX},{selectedPlacement.tileY})
              </div>
              {onMoveSelected && (
                <button
                  type="button"
                  onClick={onMoveSelected}
                  style={moveArmed ? activeButtonStyle : buttonStyle}
                  data-move-selected="true"
                >
                  {moveArmed ? 'Move: click a tile' : 'Move'}
                </button>
              )}
              {onDeleteSelected && (
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  style={deleteButtonStyle}
                  data-delete-selected="true"
                >
                  Delete
                </button>
              )}
              <div style={hintStyle}>Drag the item, or press Delete / Backspace</div>
            </>
          ) : (
            <div style={hintStyle}>Click a placed item to select it</div>
          )}
        </div>
      )}

      {/* Save/Load buttons */}
      <div style={sectionStyle}>
        <button type="button" onClick={onSave} style={buttonStyle}>
          Save Layout
        </button>
        <label style={fileLabelStyle}>
          Load Layout
          <input
            type="file"
            accept=".json"
            onChange={handleFileInput}
            style={hiddenInputStyle}
          />
        </label>
      </div>

      {/* Dev capture button (dev mode only) */}
      {devMode && onDevCapture && (
        <div style={sectionStyle}>
          <button type="button" onClick={onDevCapture} style={buttonStyle}>
            Dev Capture
          </button>
          {onDebugGrid && (
            <button type="button" onClick={onDebugGrid} style={buttonStyle}>
              Debug Walk Grid
            </button>
          )}
        </div>
      )}

      {/* Sound tester (dev mode only) */}
      {devMode && onPlaySound && availableSounds && availableSounds.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Sounds</div>
          <select
            value={selectedSound}
            onChange={(e) => setSelectedSound(e.target.value)}
            style={selectStyle}
          >
            {availableSounds.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div style={{ marginBottom: 4, color: audioReady ? '#8f8' : '#f88' }}>
            {audioReady ? 'ready' : 'not ready'}
          </div>
          <button
            type="button"
            onClick={() => onPlaySound(selectedSound)}
            style={buttonStyle}
            disabled={!audioReady}
          >
            Play Sound
          </button>
        </div>
      )}
    </div>
  );
}