// src/components/RoomDevChrome.tsx
// Presentational debug/dev chrome host (M008/S02, D021 convention).
// Props in, JSX out — no store/client imports, no application logic; the shell
// owns the editor/dev state and every callback (including the rotate resolver).
import type { EditorMode } from '../isoLayoutEditor.js';
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
}

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
}: RoomDevChromeProps) {
  return (
    <>
      {/* Layout editor panel hidden — controls moved to orchestration sidebar.
          Kept in codebase for reference; will be removed in a future cleanup phase. */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && <LayoutEditorPanel
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
      />}
    </>
  );
}
