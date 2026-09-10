// src/bus.ts
// Typed application message bus with stateful replay.
//
// Replaces the raw `window.dispatchEvent(new CustomEvent('extensionMessage'))`
// pattern, which lost events emitted before listeners attached (the demo
// kanbanCards bug, Q13b). Semantics:
//
// - emitMessage(msg): dispatch to all current listeners AND retain the message
//   for replay when it carries state (see REPLAYABLE below).
// - onMessage(handler): subscribe; every subscriber receives the retained
//   snapshot replay (state-sync semantics), so late subscribers reconstruct
//   the current state. Ephemeral messages
//   (agentRemoved, clearAgents) are applied to the retained snapshot but never
//   replayed themselves.
//
// All handlers must be idempotent — the live server already re-sends
// agentCreated/Status after reconnect, so handlers tolerate repeats.

import type { ExtensionMessage } from './agentTypes.js';

export type MessageHandler = (msg: ExtensionMessage) => void;

const listeners = new Set<MessageHandler>();

// Retained state for replay
let retainedCards: Extract<ExtensionMessage, { type: 'kanbanCards' }> | null = null;
let retainedBoardSource: Extract<ExtensionMessage, { type: 'boardSource' }> | null = null;
let retainedDevMode: Extract<ExtensionMessage, { type: 'devMode' }> | null = null;
let retainedTemplateSize: Extract<ExtensionMessage, { type: 'templateSize' }> | null = null;
const retainedAgents = new Map<string, ExtensionMessage[]>(); // agentId -> [created, ...latest updates]

function retain(msg: ExtensionMessage): void {
  switch (msg.type) {
    case 'kanbanCards':
      retainedCards = msg;
      break;
    case 'boardSource':
      retainedBoardSource = msg;
      break;
    case 'devMode':
      retainedDevMode = msg;
      break;
    case 'templateSize':
      retainedTemplateSize = msg;
      break;
    case 'agentCreated':
    case 'agentStatus':
    case 'agentTool':
    case 'agentLinkedTicket':
    case 'agentFeedMode':
      // Only track updates for agents we know about (or creations) — an
      // update for an unknown agent would create a stale replay entry
      if (msg.type === 'agentCreated' || retainedAgents.has(msg.agentId)) {
        retainedAgents.set(msg.agentId, [...(retainedAgents.get(msg.agentId) ?? []), msg]);
      }
      break;
    case 'agentRemoved':
      retainedAgents.delete(msg.agentId);
      break;
    case 'clearAgents':
      retainedAgents.clear();
      break;
    default:
      // toggleOverlay, autoFollow, editor*, playSound, requestClassification:
      // ephemeral host/app control messages — not retained.
      break;
  }
}

function replayTo(handler: MessageHandler): void {
  if (retainedCards) handler(retainedCards);
  if (retainedBoardSource) handler(retainedBoardSource);
  if (retainedDevMode) handler(retainedDevMode);
  if (retainedTemplateSize) handler(retainedTemplateSize);
  // Per agent: created first, then the retained update sequence
  for (const msgs of retainedAgents.values()) {
    for (const msg of msgs) handler(msg);
  }
}

export function emitMessage(msg: ExtensionMessage): void {
  retain(msg);
  for (const handler of listeners) handler(msg);
}

export function onMessage(handler: MessageHandler): () => void {
  listeners.add(handler);
  // State-sync semantics: every new subscriber receives the retained snapshot
  // (handlers must be idempotent — the live server re-sends agentCreated etc.
  // after reconnects, so handlers already tolerate repeats).
  replayTo(handler);
  return () => {
    listeners.delete(handler);
  };
}

/** Test/debug: wipe retention and listener state */
export function resetBus(): void {
  listeners.clear();
  retainedCards = null;
  retainedBoardSource = null;
  retainedDevMode = null;
  retainedTemplateSize = null;
  retainedAgents.clear();
}
