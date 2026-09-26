// .opencode/plugin/sync-wake.ts
// Q14: inject a GitHub→GSD sync wake note into the first message of each
// opencode session (unseen inbox intents only). Shells the shared CLI so the
// same logic serves every harness. Loaded at startup; restart to pick up.
import { execFileSync } from 'node:child_process';

export default async ({ directory }: { directory?: string }) => {
  const woken = new Set<string>();
  return {
    'chat.message': async (
      input: { sessionID?: string },
      output: { message?: { id?: string }; parts?: Array<Record<string, unknown>> },
    ) => {
      try {
        const sessionID = input?.sessionID;
        const messageID = output?.message?.id;
        if (!sessionID || !messageID || woken.has(sessionID)) return;
        woken.add(sessionID);
        const note = execFileSync('node', ['scripts/hooks/gsd-sync-wake.mjs'], {
          cwd: directory ?? process.cwd(),
          encoding: 'utf8',
          timeout: 10_000,
        }).trim();
        if (!note) return;
        output.parts?.push({
          id: `prt_syncwake_${Date.now().toString(36)}`,
          sessionID,
          messageID,
          type: 'text',
          text: note,
          synthetic: true,
        });
      } catch {
        // The wake must never break the session.
      }
    },
  };
};
