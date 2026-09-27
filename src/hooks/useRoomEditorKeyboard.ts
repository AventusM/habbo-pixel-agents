// src/hooks/useRoomEditorKeyboard.ts
// Room-editor keyboard actions (M009/S02, D021 convention): Delete/Backspace
// removes the selected placed furniture. The listener is only bound while the
// furniture editor is active and never fires while a form control has focus.
import { useEffect } from 'react';

export interface UseRoomEditorKeyboardOptions {
  enabled: boolean;
  onDelete: () => void;
}

export function useRoomEditorKeyboard({ enabled, onDelete }: UseRoomEditorKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onDelete();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onDelete]);
}
