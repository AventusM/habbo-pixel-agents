// .opencode/plugin/jeve-handoff.ts
// Q15: on every session idle, write a rolling JEV/abide handoff report for the
// pass into .gsd/runtime/jeve-handoff (+ one hooks-feed row). Shells the shared
// CLI so every harness reads the same artifact; never blocks or breaks a
// session. Loaded at startup; restart to pick up.
import { execFileSync } from 'node:child_process';

export default async ({ directory }: { directory?: string }) => {
  const inFlight = new Set<string>();
  return {
    event: async (
      input: { event?: { type?: string; properties?: Record<string, unknown> } },
    ) => {
      try {
        const event = input?.event;
        if (event?.type !== 'session.idle') return;
        const sessionID =
          typeof event.properties?.sessionID === 'string' ? event.properties.sessionID : '';
        if (!sessionID || inFlight.has(sessionID)) return;
        inFlight.add(sessionID);
        try {
          execFileSync(
            'node',
            [
              'scripts/hooks/jeve-report.mjs',
              '--out',
              '.gsd/runtime/jeve-handoff',
              '--name',
              sessionID,
              '--latest',
              '--feed',
              '--quiet',
              '--stdout',
              'none',
            ],
            {
              cwd: directory ?? process.cwd(),
              encoding: 'utf8',
              timeout: 60_000,
              env: { ...process.env, JEVE_SESSION: sessionID },
            },
          );
        } finally {
          inFlight.delete(sessionID);
        }
      } catch {
        // The handoff must never break the session.
      }
    },
  };
};
