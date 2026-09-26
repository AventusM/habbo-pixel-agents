// src/components/CharacterEditorPanel.tsx
// Presentational character editor panel (M006/S02, D021 convention).
// Props in, JSX out: a role selector for the four TeamSection roles, shirt and
// hair color swatches plus a hair-style selector rendered from the view model the
// shell passes, and a `children` slot that hosts the live preview. It imports no
// stores/clients and contains no application logic or data wiring — it only
// renders values and calls the callbacks it is given. Styling follows the dark
// room-overlay idiom used by the other editor panels.
import type { CSSProperties, ReactNode } from 'react';
import type { CatalogItem } from '../avatarOutfitConfig.js';
import type { TeamSection } from '../agentTypes.js';

/** Display labels for the four TeamSection roles (presentation only). */
const ROLE_LABELS: Record<TeamSection, string> = {
  'planning': 'Planning',
  'core-dev': 'Core Dev',
  'infrastructure': 'Infrastructure',
  'support': 'Support',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 10,
  top: 10,
  zIndex: 1000,
  width: 240,
  padding: 10,
  borderRadius: 4,
  background: 'rgba(0, 0, 0, 0.8)',
  color: 'white',
  font: '12px/1.4 Arial, sans-serif',
  boxSizing: 'border-box',
};

const sectionStyle: CSSProperties = {
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid #666',
};

const labelStyle: CSSProperties = { opacity: 0.8, marginBottom: 4 };

const roleButtonStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 6px',
  margin: '2px 2px 2px 0',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  background: '#444',
  color: 'white',
};

const activeRoleButtonStyle: CSSProperties = {
  ...roleButtonStyle,
  background: '#0066cc',
  fontWeight: 'bold',
};

const swatchRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4,
};

const swatchStyle: CSSProperties = {
  width: 18,
  height: 18,
  padding: 0,
  borderRadius: 3,
  border: '1px solid #666',
  cursor: 'pointer',
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: 4,
  marginTop: 4,
  boxSizing: 'border-box',
};

export interface CharacterEditorPanelProps {
  roles: readonly TeamSection[];
  activeRole: TeamSection;
  onSelectRole: (role: TeamSection) => void;
  hairOptions: readonly CatalogItem[];
  selectedHairPart: { asset: string; setId: number };
  onSelectHair: (item: CatalogItem) => void;
  hairColors: readonly string[];
  selectedHairColor: string;
  onSelectHairColor: (hex: string) => void;
  shirtColors: readonly string[];
  selectedShirtColor: string;
  onSelectShirtColor: (hex: string) => void;
  onResetRole: (role: TeamSection) => void;
  /** Live preview slot. */
  children?: ReactNode;
}

export function CharacterEditorPanel({
  roles,
  activeRole,
  onSelectRole,
  hairOptions,
  selectedHairPart,
  onSelectHair,
  hairColors,
  selectedHairColor,
  onSelectHairColor,
  shirtColors,
  selectedShirtColor,
  onSelectShirtColor,
  onResetRole,
  children,
}: CharacterEditorPanelProps) {
  const selectedHairId =
    hairOptions.find(
      (item) => item.asset === selectedHairPart.asset && item.setId === selectedHairPart.setId,
    )?.id ?? '';

  const handleHairChange = (id: string) => {
    const item = hairOptions.find((option) => option.id === id);
    if (item) onSelectHair(item);
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 'bold' }}>Character Editor</div>

      {/* Live preview slot */}
      {children}

      {/* Role selector */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Role</div>
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            data-role={role}
            style={role === activeRole ? activeRoleButtonStyle : roleButtonStyle}
            onClick={() => onSelectRole(role)}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      {/* Shirt color swatches */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Shirt color</div>
        <div style={swatchRowStyle} data-swatch-group="shirt">
          {shirtColors.map((hex) => (
            <button
              key={hex}
              type="button"
              data-swatch={hex}
              aria-label={`shirt ${hex}`}
              style={{
                ...swatchStyle,
                background: hex,
                outline: hex === selectedShirtColor ? '2px solid #fff' : 'none',
              }}
              onClick={() => onSelectShirtColor(hex)}
            />
          ))}
        </div>
      </div>

      {/* Hair color swatches */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Hair color</div>
        <div style={swatchRowStyle} data-swatch-group="hair">
          {hairColors.map((hex) => (
            <button
              key={hex}
              type="button"
              data-hair-swatch={hex}
              aria-label={`hair ${hex}`}
              style={{
                ...swatchStyle,
                background: hex,
                outline: hex === selectedHairColor ? '2px solid #fff' : 'none',
              }}
              onClick={() => onSelectHairColor(hex)}
            />
          ))}
        </div>
      </div>

      {/* Hair style selector */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Hair style</div>
        <select
          data-hair-select="true"
          style={selectStyle}
          value={selectedHairId}
          onChange={(e) => handleHairChange(e.target.value)}
        >
          {hairOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Reset active role */}
      <div style={sectionStyle}>
        <button
          type="button"
          data-reset={activeRole}
          style={roleButtonStyle}
          onClick={() => onResetRole(activeRole)}
        >
          Reset {ROLE_LABELS[activeRole]}
        </button>
      </div>
    </div>
  );
}
