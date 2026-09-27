// src/components/DebugSurfaces.tsx
// Presentational debug-surfaces overlay (M009/S03, D021 convention): the
// spritesheet matrix for a chosen role outfit plus the role-outfit matrix for
// all four roles. Props in, JSX out — no stores, no host APIs; the only local
// state is the UI selection (role, direction set), exempt under D021.

import { useState, type CSSProperties } from 'react';
import type { SpriteCache } from '../isoSpriteCache.js';
import type { TeamSection } from '../agentTypes.js';
import { AvatarDebugGrid } from '../AvatarDebugGrid.js';
import { RoleOutfitMatrix } from './RoleOutfitMatrix.js';
import {
  DEBUG_DIRECTION_SETS,
  DEBUG_ROLE_OPTIONS,
  DEFAULT_DEBUG_DIRECTION_SET_ID,
  DEFAULT_DEBUG_ROLE,
  findRoleOutfitRow,
  getDebugDirectionSet,
} from '../debugSurfacesModel.js';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  zIndex: 2000,
  overflow: 'auto',
  padding: 20,
  boxSizing: 'border-box',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  textAlign: 'left',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  marginBottom: 10,
  fontWeight: 'bold',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  fontWeight: 'normal',
};

const selectStyle: CSSProperties = { padding: '2px 4px' };

const closeButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 12px',
  cursor: 'pointer',
  backgroundColor: '#c33',
  color: '#fff',
  border: 'none',
  borderRadius: 3,
  font: '12px/1.4 monospace',
};

const sectionStyle: CSSProperties = {
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid rgba(148, 163, 184, 0.25)',
};

const sectionTitleStyle: CSSProperties = { opacity: 0.85, marginBottom: 4 };

export interface DebugSurfacesProps {
  spriteCache: SpriteCache | null;
  onClose: () => void;
}

export function DebugSurfaces({ spriteCache, onClose }: DebugSurfacesProps) {
  const [role, setRole] = useState<TeamSection>(DEFAULT_DEBUG_ROLE);
  const [directionSetId, setDirectionSetId] = useState<string>(DEFAULT_DEBUG_DIRECTION_SET_ID);

  const roleRow = findRoleOutfitRow(role);
  const directionSet = getDebugDirectionSet(directionSetId);

  return (
    <div style={overlayStyle} data-debug-surfaces="true">
      <div style={headerStyle}>
        <span>Debug Surfaces</span>
        <label style={labelStyle}>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamSection)}
            style={selectStyle}
            data-debug-role="true"
          >
            {DEBUG_ROLE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Directions
          <select
            value={directionSet.id}
            onChange={(e) => setDirectionSetId(e.target.value)}
            style={selectStyle}
            data-debug-direction-set="true"
          >
            {DEBUG_DIRECTION_SETS.map((set) => (
              <option key={set.id} value={set.id}>
                {set.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClose} style={closeButtonStyle} data-debug-close="true">
          Close
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Sprite Sheet Matrix — {roleRow.label}</div>
        <AvatarDebugGrid
          embedded
          spriteCache={spriteCache}
          outfit={roleRow.outfit}
          directions={directionSet.directions}
        />
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Role Outfit Matrix — all roles</div>
        <RoleOutfitMatrix spriteCache={spriteCache} />
      </div>
    </div>
  );
}
