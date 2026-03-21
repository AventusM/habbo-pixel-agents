/**
 * Demo data for standalone mode.
 *
 * Dispatches extensionMessage CustomEvents to simulate agent activity.
 * Uses the same message protocol as the VS Code extension host.
 */
import type { TeamSection, KanbanCard } from '../agentTypes.js';

function dispatch(msg: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('extensionMessage', { detail: msg }));
}

const DEMO_AGENTS: Array<{
  id: string;
  name: string;
  team: TeamSection;
  variant: number;
  tools: string[];
}> = [
  {
    id: 'demo-coder-1',
    name: 'Alice',
    team: 'core-dev',
    variant: 0,
    tools: ['Read src/renderer.ts', 'Edit RoomCanvas.tsx', 'Bash npm test', 'Write utils.ts'],
  },
  {
    id: 'demo-planner-1',
    name: 'Bob',
    team: 'planning',
    variant: 1,
    tools: ['Read ROADMAP.md', 'Write S01-PLAN.md', 'Bash git log --oneline'],
  },
  {
    id: 'demo-infra-1',
    name: 'Carol',
    team: 'infrastructure',
    variant: 2,
    tools: ['Bash docker build .', 'Read Dockerfile', 'Edit deploy.yml'],
  },
];

/**
 * Schedule demo agent events on a timeline.
 * Spawns agents, sets them active with tool text, then idles them.
 */
export function scheduleDemoEvents(): void {
  console.log('[Demo] Scheduling demo agent events...');

  // Send demo kanban cards with enriched data
  const demoCards: KanbanCard[] = [
    {
      id: '101', title: 'Implement room renderer', status: 'Doing',
      workItemType: 'User Story', assignee: 'Alice',
      children: [
        { id: '101-1', title: 'Extract Canvas 2D code', state: 'Done', completed: true },
        { id: '101-2', title: 'Add WebSocket client', state: 'Done', completed: true },
        { id: '101-3', title: 'Wire demo avatars', state: 'Active', completed: false },
      ],
      linkedPrs: [
        { id: '42', title: 'feat: standalone renderer', status: 'active' },
      ],
    },
    {
      id: '102', title: 'Azure DevOps integration', status: 'Doing',
      workItemType: 'User Story', assignee: 'Bob',
      children: [
        { id: '102-1', title: 'Fetch work items', state: 'Done', completed: true },
        { id: '102-2', title: 'Fetch sub-tasks', state: 'Active', completed: false },
      ],
    },
    { id: '103', title: 'Fix avatar rendering glitch', status: 'To Do', workItemType: 'Bug' },
    { id: '104', title: 'Add sound effects', status: 'To Do', workItemType: 'Task' },
    { id: '105', title: 'Deploy to staging', status: 'Done', workItemType: 'Task', assignee: 'Carol' },
    { id: '106', title: 'Write tests for pathfinding', status: 'Done', workItemType: 'Task' },
  ];
  dispatch({ type: 'kanbanCards', cards: demoCards });

  let delay = 500;

  for (const agent of DEMO_AGENTS) {
    // Spawn
    setTimeout(() => {
      dispatch({
        type: 'agentCreated',
        agentId: agent.id,
        terminalName: agent.name,
        variant: agent.variant,
        team: agent.team,
        role: agent.team,
      });
      console.log(`[Demo] Spawned ${agent.name} (${agent.team})`);
    }, delay);
    delay += 1500;

    // Set active after spawn animation
    setTimeout(() => {
      dispatch({
        type: 'agentStatus',
        agentId: agent.id,
        status: 'active',
      });
    }, delay);
    delay += 500;

    // Cycle through tool texts
    for (const tool of agent.tools) {
      const toolDelay = delay;
      setTimeout(() => {
        dispatch({
          type: 'agentTool',
          agentId: agent.id,
          toolName: tool.split(' ')[0],
          displayText: tool,
        });
      }, toolDelay);
      delay += 3000;
    }

    // Go idle between cycles
    const idleDelay = delay;
    setTimeout(() => {
      dispatch({
        type: 'agentStatus',
        agentId: agent.id,
        status: 'idle',
      });
    }, idleDelay);
    delay += 2000;
  }

  // Loop the demo after all agents complete their first cycle
  const loopDelay = delay + 2000;
  setTimeout(() => {
    console.log('[Demo] Restarting demo cycle...');
    // Reactivate agents
    for (let i = 0; i < DEMO_AGENTS.length; i++) {
      const agent = DEMO_AGENTS[i];
      setTimeout(() => {
        dispatch({ type: 'agentStatus', agentId: agent.id, status: 'active' });
        // Feed new tool text
        const tool = agent.tools[Math.floor(Math.random() * agent.tools.length)];
        setTimeout(() => {
          dispatch({
            type: 'agentTool',
            agentId: agent.id,
            toolName: tool.split(' ')[0],
            displayText: tool,
          });
        }, 1000);
        // Idle again after a while
        setTimeout(() => {
          dispatch({ type: 'agentStatus', agentId: agent.id, status: 'idle' });
        }, 8000 + Math.random() * 4000);
      }, i * 2000);
    }

    // Schedule next loop
    setTimeout(() => scheduleDemoLoop(), 20000);
  }, loopDelay);
}

/**
 * Continuous demo loop — cycles agents between active/idle with tool text.
 */
function scheduleDemoLoop(): void {
  for (let i = 0; i < DEMO_AGENTS.length; i++) {
    const agent = DEMO_AGENTS[i];
    setTimeout(() => {
      dispatch({ type: 'agentStatus', agentId: agent.id, status: 'active' });
      const tool = agent.tools[Math.floor(Math.random() * agent.tools.length)];
      setTimeout(() => {
        dispatch({
          type: 'agentTool',
          agentId: agent.id,
          toolName: tool.split(' ')[0],
          displayText: tool,
        });
      }, 1000);
      setTimeout(() => {
        dispatch({ type: 'agentStatus', agentId: agent.id, status: 'idle' });
      }, 6000 + Math.random() * 6000);
    }, i * 3000);
  }
  setTimeout(() => scheduleDemoLoop(), 25000);
}
