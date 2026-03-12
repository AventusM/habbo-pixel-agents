// src/CharacterLegendPanel.tsx
// Character legend panel — shows team-to-character mapping in the room view.
// Read-only legend positioned at the bottom-right corner.

import React from 'react';
import type { TeamSection } from './agentTypes.js';

/** Team color scheme matching the room's section colors */
const TEAM_CONFIG: Array<{ team: TeamSection; label: string; color: string }> = [
  { team: 'planning',       label: 'Planning',       color: '#3B5998' },
  { team: 'core-dev',       label: 'Core Dev',       color: '#5BD55B' },
  { team: 'infrastructure', label: 'Infrastructure', color: '#D4A017' },
  { team: 'support',        label: 'Support',        color: '#9B5BD5' },
];

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '10px',
  right: '10px',
  background: 'rgba(0, 0, 0, 0.7)',
  borderRadius: '6px',
  padding: '8px 10px',
  minWidth: '160px',
  zIndex: 100,
  pointerEvents: 'none',
};

const titleStyle: React.CSSProperties = {
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '8px',
  color: '#ffffff',
  marginBottom: '8px',
  letterSpacing: '0.5px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '5px',
};

const dotStyle = (color: string): React.CSSProperties => ({
  width: '10px',
  height: '10px',
  borderRadius: '2px',
  background: color,
  flexShrink: 0,
  marginRight: '7px',
});

const labelStyle: React.CSSProperties = {
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '6px',
  color: '#cccccc',
};

/**
 * CharacterLegendPanel — a fixed overlay at the bottom-right of the room canvas
 * showing which team maps to which PixelLab character color.
 */
export function CharacterLegendPanel(): React.ReactElement {
  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Teams</div>
      {TEAM_CONFIG.map(({ team, label, color }) => (
        <div key={team} style={rowStyle}>
          <div style={dotStyle(color)} />
          <span style={labelStyle}>{label}</span>
        </div>
      ))}
    </div>
  );
}
