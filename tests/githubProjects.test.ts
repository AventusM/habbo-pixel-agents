// tests/githubProjects.test.ts
// Unit tests for GitHub Projects v2 fetch logic

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock fs (writeFileSync, unlinkSync) to avoid touching the filesystem
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { fetchKanbanCards } from '../src/githubProjects.js';

const mockedExecFileSync = vi.mocked(execFileSync);

// Minimal valid GraphQL responses
const PROJECT_ID_RESPONSE = JSON.stringify({
  data: {
    organization: {
      projectV2: { id: 'PVT_kwDOA123' },
    },
  },
});

function buildItemsResponse(
  items: Array<{
    id: string;
    contentTitle: string | null;
    statusName?: string;
  }>
) {
  return JSON.stringify({
    data: {
      node: {
        items: {
          nodes: items.map((item) => ({
            id: item.id,
            content: item.contentTitle !== null ? { title: item.contentTitle } : null,
            fieldValues: {
              nodes: item.statusName
                ? [{ name: item.statusName, field: { name: 'Status' } }]
                : [],
            },
          })),
        },
      },
    },
  });
}

describe('fetchKanbanCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] when execFileSync throws (gh not installed or auth failure)', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('gh: command not found');
    });

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result).toEqual([]);
  });

  it('parses cards correctly from a valid response with Issue and DraftIssue', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-1', contentTitle: 'Fix the login bug', statusName: 'In Progress' },
          { id: 'item-2', contentTitle: 'Add dark mode', statusName: 'Todo' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'item-1', title: 'Fix the login bug', status: 'In Progress' });
    expect(result[1]).toEqual({ id: 'item-2', title: 'Add dark mode', status: 'Todo' });
  });

  it('defaults status to "No Status" when no Status field value is present', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-3', contentTitle: 'Orphaned card' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('No Status');
  });

  it('defaults title to "(no title)" when content title is null (deleted issue)', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-4', contentTitle: null, statusName: 'Done' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('(no title)');
    expect(result[0].status).toBe('Done');
  });

  it('uses user query instead of organization query when ownerType is "user"', () => {
    mockedExecFileSync
      .mockReturnValueOnce(
        JSON.stringify({
          data: {
            user: {
              projectV2: { id: 'PVT_kwUser456' },
            },
          },
        }) as ReturnType<typeof execFileSync>
      )
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-5', contentTitle: 'Personal task', statusName: 'In Progress' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-user', 2, 'user');

    // Verify the org/user query was built correctly by checking the first call args
    const firstCallArgs = mockedExecFileSync.mock.calls[0] as unknown as [string, string[]];
    const queryArg = firstCallArgs[1].find((arg: string) => arg.startsWith('query='));
    expect(queryArg).toContain('user(login: "my-user")');
    expect(queryArg).not.toContain('organization(');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Personal task');
  });
});
