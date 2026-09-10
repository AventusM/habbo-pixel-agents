// tests/appMode.test.ts
// Unit tests for the demo/live mode machine: initial state, named transitions,
// transition logging, invalid/self transitions, and subscribers.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppModeMachine, isValidModeTransition } from '../src/state/appMode.js';

describe('appMode', () => {
  let machine: AppModeMachine;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    machine = new AppModeMachine();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('starts in booting with no transitions', () => {
    expect(machine.mode).toBe('booting');
    expect(machine.state.transitions).toEqual([]);
  });

  it('applies a valid transition and records it', () => {
    expect(machine.transition('live', 'ws connected', 1000)).toBe(true);
    expect(machine.mode).toBe('live');
    expect(machine.state.transitions).toEqual([
      { from: 'booting', to: 'live', reason: 'ws connected', at: 1000 },
    ]);
  });

  it('logs each transition', () => {
    machine.transition('demo', 'no real agents within 5s', 2000);
    expect(logSpy).toHaveBeenCalledWith('[Mode] booting -> demo (no real agents within 5s)');
  });

  it('ignores a self-transition', () => {
    machine.transition('live', 'first');
    expect(machine.transition('live', 'again')).toBe(false);
    expect(machine.state.transitions).toHaveLength(1);
  });

  it('rejects an invalid transition and warns', () => {
    machine.transition('live', 'first');
    expect(machine.transition('booting', 'rewind')).toBe(false);
    expect(machine.mode).toBe('live');
    expect(machine.state.transitions).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('supports live -> degraded -> live recovery', () => {
    machine.transition('live', 'ws connected');
    machine.transition('degraded', 'ws disconnected');
    machine.transition('live', 'ws reconnected');
    expect(machine.mode).toBe('live');
    expect(machine.state.transitions.map((t) => t.to)).toEqual(['live', 'degraded', 'live']);
  });

  it('notifies subscribers with the new state', () => {
    const seen: string[] = [];
    machine.subscribe((state) => seen.push(state.mode));
    machine.transition('live', 'ws connected');
    expect(seen).toEqual(['booting', 'live']);
  });

  it('exposes the transition table', () => {
    expect(isValidModeTransition('booting', 'demo')).toBe(true);
    expect(isValidModeTransition('booting', 'booting')).toBe(false);
    expect(isValidModeTransition('degraded', 'booting')).toBe(false);
  });
});
