// src/sectionManager.ts
// Section state and agent-to-section mapping for multi-section room layout.
// Tracks which agents belong to which team section and provides
// tile lookups for spawning, desks, and idle wandering.

import type { FloorTemplate, SectionLayout } from './roomLayoutEngine.js';
import type { TeamSection } from './agentTypes.js';

/** State for a single section */
export interface SectionState {
  team: TeamSection;
  agentIds: string[];
  activityLevel: number;
  lastActivityMs: number;
}

/**
 * Manages agent-to-section assignments and provides tile lookups
 * for spawning, desk placement, and idle wandering within sections.
 */
export class SectionManager {
  private sections = new Map<TeamSection, SectionState>();
  private template: FloorTemplate;
  private agentTeamMap = new Map<string, TeamSection>();

  constructor(template: FloorTemplate) {
    this.template = template;

    for (const section of template.sections) {
      this.sections.set(section.team, {
        team: section.team,
        agentIds: [],
        activityLevel: 0,
        lastActivityMs: 0,
      });
    }
  }

  /** Assign an agent to a team section */
  assignAgent(agentId: string, team: TeamSection): void {
    // Remove from any previous section first
    this.removeAgent(agentId);

    const state = this.sections.get(team);
    if (state) {
      state.agentIds.push(agentId);
    }
    this.agentTeamMap.set(agentId, team);
  }

  /** Remove an agent from all sections */
  removeAgent(agentId: string): void {
    const team = this.agentTeamMap.get(agentId);
    if (team) {
      const state = this.sections.get(team);
      if (state) {
        state.agentIds = state.agentIds.filter(id => id !== agentId);
      }
      this.agentTeamMap.delete(agentId);
    }
  }

  /** Get the team an agent belongs to */
  getAgentTeam(agentId: string): TeamSection | null {
    return this.agentTeamMap.get(agentId) ?? null;
  }

  /** Get the teleport booth tile for a team section */
  getSpawnTile(team: TeamSection): { x: number; y: number } | null {
    const section = this.getSectionLayout(team);
    return section ? { ...section.teleportTile } : null;
  }

  /** Get the first unoccupied desk tile for a team section */
  getDeskTile(team: TeamSection, existingOccupied: Set<string>): { x: number; y: number; dir: number } | null {
    const section = this.getSectionLayout(team);
    if (!section) return null;

    for (const desk of section.deskTiles) {
      const key = `${desk.x},${desk.y}`;
      if (!existingOccupied.has(key)) {
        return { x: desk.x, y: desk.y, dir: desk.dir };
      }
    }

    // All desks occupied, return the first one as fallback
    if (section.deskTiles.length > 0) {
      const d = section.deskTiles[0];
      return { x: d.x, y: d.y, dir: d.dir };
    }

    return null;
  }

  /** Get a random idle tile within a section */
  getIdleTile(team: TeamSection): { x: number; y: number } | null {
    const section = this.getSectionLayout(team);
    if (!section || section.idleTiles.length === 0) return null;

    const idx = Math.floor(Math.random() * section.idleTiles.length);
    return { ...section.idleTiles[idx] };
  }

  /** Get the agent count for a section */
  getSectionAgentCount(team: TeamSection): number {
    return this.sections.get(team)?.agentIds.length ?? 0;
  }

  /** Update the activity timestamp for a team section */
  updateActivity(team: TeamSection, currentMs: number): void {
    const state = this.sections.get(team);
    if (state) {
      state.activityLevel++;
      state.lastActivityMs = currentMs;
    }
  }

  /** Get the team section with the most recent activity */
  getMostActiveSection(): TeamSection | null {
    let best: SectionState | null = null;
    for (const state of this.sections.values()) {
      if (!best || state.lastActivityMs > best.lastActivityMs) {
        best = state;
      }
    }
    return best?.team ?? null;
  }

  /** Get the section state for a team */
  getSectionState(team: TeamSection): SectionState | undefined {
    return this.sections.get(team);
  }

  /** Get all section states */
  getAllSections(): SectionState[] {
    return Array.from(this.sections.values());
  }

  /** Get the floor template */
  getTemplate(): FloorTemplate {
    return this.template;
  }

  /** Get the center tile of a section in world coordinates */
  getSectionCenter(team: TeamSection): { x: number; y: number } | null {
    const section = this.getSectionLayout(team);
    if (!section) return null;
    const cx = section.originTile.x + Math.floor(section.widthTiles / 2);
    const cy = section.originTile.y + Math.floor(section.heightTiles / 2);
    return { x: cx, y: cy };
  }

  /** Internal: get section layout from template */
  private getSectionLayout(team: TeamSection): SectionLayout | undefined {
    return this.template.sections.find(s => s.team === team);
  }
}
