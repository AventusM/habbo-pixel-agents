// src/avatarSelection.ts
// Avatar selection state for click-to-move interaction

export class AvatarSelectionManager {
  /** Currently selected avatar ID, or null */
  selectedAvatarId: string | null = null;

  /**
   * Select an avatar by ID.
   */
  selectAvatar(id: string): void {
    this.selectedAvatarId = id;
  }

  /**
   * Deselect the current avatar.
   */
  deselectAvatar(): void {
    this.selectedAvatarId = null;
  }

  /**
   * Check if a specific avatar is selected.
   */
  isSelected(id: string): boolean {
    return this.selectedAvatarId === id;
  }
}
