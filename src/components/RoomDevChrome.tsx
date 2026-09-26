// src/components/RoomDevChrome.tsx
// Presentational debug/dev chrome host (M008/S02, M009/S01, D021 convention).
// Renders the floating Room Editor entry toggle and, when open, the layout
// editor panel. Props in, JSX out — no store/client imports, no application
// logic; the shell owns the editor state, the open/close state and every
// callback (including the rotate resolver).
import type { CSSProperties } from 'react';
import type { EditorMode, PlacedFurnitureInfo } from '../isoLayoutEditor.js';
import type { HsbColor } from '../isoTypes.js';
import { LayoutEditorPanel } from '../LayoutEditorPanel.js';

export interface RoomDevChromeProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  selectedColor: HsbColor;
  onColorChange: (color: HsbColor) => void;
  selectedFurniture: string;
  onFurnitureChange: (furniture: string) => void;
  furnitureDirection: number;
  devMode: boolean;
  onDevCapture: () => void;
  onPlaySound: (soundName: string) => void;
  availableSounds: string[];
  audioReady?: boolean;
  onRotate: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  selectedPlacement?: PlacedFurnitureInfo | null;
  moveArmed?: boolean;
  onMoveSelected?: () => void;
  onDeleteSelected?: () => void;
  wallColorSections?: ReadonlyArray<{ id: string; label: string }>;
  wallColors?: Record<string, HsbColor>;
  onWallColorChange?: (sectionId: string, color: HsbColor) => void;
  onWallColorClear?: (sectionId: string) => void;
  /** Whether the layout editor panel is expanded (shell-owned). */
  editorOpen: boolean;
  /** Toggle the layout editor panel (shell-owned). */
  onEditorToggle: () => void;
}

/** Floating entry toggle, stacked above the Character Editor toggle. */
const toggleStyle: CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 46,
  zIndex: 1000,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  cursor: 'pointer',
};

export function RoomDevChrome({
  editorMode,
  onModeChange,
  selectedColor,
  onColorChange,
  selectedFurniture,
  onFurnitureChange,
  furnitureDirection,
  devMode,
  onDevCapture,
  onPlaySound,
  availableSounds,
  audioReady,
  onRotate,
  onSave,
  onLoad,
  selectedPlacement,
  moveArmed,
  onMoveSelected,
  onDeleteSelected,
  wallColorSections,
  wallColors,
  onWallColorChange,
  onWallColorClear,
  editorOpen,
  onEditorToggle,
}: RoomDevChromeProps) {
  return (
    <>
      <button
        type="button"
        style={toggleStyle}
        aria-expanded={editorOpen}
        onClick={onEditorToggle}
      >
        {editorOpen ? 'Close Room Editor' : 'Room Editor'}
      </button>
      {editorOpen && (
        <LayoutEditorPanel
          editorMode={editorMode}
          onModeChange={onModeChange}
          selectedColor={selectedColor}
          onColorChange={onColorChange}
          selectedFurniture={selectedFurniture}
          onFurnitureChange={onFurnitureChange}
          furnitureDirection={furnitureDirection}
          devMode={devMode}
          onDevCapture={onDevCapture}
          onDebugGrid={undefined}
          onPlaySound={onPlaySound}
          availableSounds={availableSounds}
          audioReady={audioReady}
          onRotate={onRotate}
          onSave={onSave}
          onLoad={onLoad}
          onClose={onEditorToggle}
          selectedPlacement={selectedPlacement}
          moveArmed={moveArmed}
          onMoveSelected={onMoveSelected}
          onDeleteSelected={onDeleteSelected}
          wallColorSections={wallColorSections}
          wallColors={wallColors}
          onWallColorChange={onWallColorChange}
          onWallColorClear={onWallColorClear}
        />
      )}
    </>
  );
}