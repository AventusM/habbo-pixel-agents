// .opencode/plugin/role-feed.ts
// M003 gsd-loop trial (issue #84, O-2): role-tagged tool feed for opencode
// agents (paseo-driven sessions included). Appends to the shared hook feed
// contract (.gsd/hooks-feed.jsonl — gitignored). Loaded by opencode at
// startup; changes require an opencode restart. Role via AGENT_ROLE env.
import { appendFileSync } from 'node:fs';

const FEED = '.gsd/hooks-feed.jsonl';
const ROLE = process.env.AGENT_ROLE ?? 'core-dev';

export default async () => ({
  'tool.execute.after': async (input: unknown) => {
    try {
      const i = input as {
        tool?: string;
        args?: Record<string, unknown>;
        session_id?: string;
      };
      const summary = String(
        i?.args?.file_path ?? i?.args?.command ?? i?.tool ?? 'tool',
      ).slice(0, 120);
      appendFileSync(
        FEED,
        JSON.stringify({
          source: 'opencode-role-feed',
          ts: new Date().toISOString(),
          role: ROLE,
          sessionId: i?.session_id,
          tool: i?.tool,
          summary,
        }) + '\n',
      );
    } catch {
      // The feed must never break the agent.
    }
  },
});
