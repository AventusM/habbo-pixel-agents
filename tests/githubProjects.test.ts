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
    labels?: string[];
    bodyText?: string;
    body?: string;
    url?: string;
  }>
) {
  return JSON.stringify({
    data: {
      node: {
        items: {
          nodes: items.map((item) => ({
            id: item.id,
            content: item.contentTitle !== null
              ? {
                  title: item.contentTitle,
                  ...(item.bodyText !== undefined ? { bodyText: item.bodyText } : {}),
                  ...(item.body !== undefined ? { body: item.body } : {}),
                  ...(item.url !== undefined ? { url: item.url } : {}),
                  ...(item.labels
                    ? { labels: { nodes: item.labels.map((name) => ({ name })) } }
                    : {}),
                }
              : null,
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
    expect(result[0]).toEqual({ id: 'item-1', title: 'Fix the login bug', status: 'In Progress', labels: [] });
    expect(result[1]).toEqual({ id: 'item-2', title: 'Add dark mode', status: 'Todo', labels: [] });
  });

  it('maps issue description and url onto the card', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          {
            id: 'item-7',
            contentTitle: 'M001/S01 planning slice',
            statusName: 'Backlog',
            bodyText: 'Decide and document the RetroDiffusion pipeline.',
            url: 'https://github.com/AventusM/habbo-pixel-agents/issues/58',
          },
          { id: 'item-8', contentTitle: 'No body card', statusName: 'Backlog' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result[0].description).toBe('Decide and document the RetroDiffusion pipeline.');
    expect(result[0].url).toBe('https://github.com/AventusM/habbo-pixel-agents/issues/58');
    expect(result[1].description).toBeUndefined();
    expect(result[1].url).toBeUndefined();
  });

  it('truncates long descriptions at 600 chars with an ellipsis', () => {
    const longBody = 'x'.repeat(2000);
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-9', contentTitle: 'Long body', statusName: 'Todo', bodyText: longBody },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result[0].description).toHaveLength(600);
    expect(result[0].description?.endsWith('…')).toBe(true);
  });

  it('extracts the DoD checklist from the issue body', () => {
    const body = [
      'Slice of epic #57.',
      '',
      '**Success criteria:**',
      '- [x] Pack script adapted',
      '- [ ] Avatar walks in room',
      '',
      'Authority: read-only mirror.',
    ].join('\n');
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-10', contentTitle: 'S01 slice', statusName: 'Backlog', body },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result[0].dod).toEqual([
      { text: 'Pack script adapted', done: true },
      { text: 'Avatar walks in room', done: false },
    ]);
  });

  it('omits dod when the body has no checklist section', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-11', contentTitle: 'No dod', statusName: 'Todo', body: 'just text' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');
    expect(result[0].dod).toBeUndefined();
  });

  it('maps GitHub issue labels into card labels', () => {
    mockedExecFileSync
      .mockReturnValueOnce(PROJECT_ID_RESPONSE as ReturnType<typeof execFileSync>)
      .mockReturnValueOnce(
        buildItemsResponse([
          { id: 'item-5', contentTitle: 'M001 epic', statusName: 'Backlog', labels: ['gsd', 'M001'] },
          { id: 'item-6', contentTitle: 'Demo draft', statusName: 'Backlog' },
        ]) as ReturnType<typeof execFileSync>
      );

    const result = fetchKanbanCards('my-org', 1, 'org');

    expect(result).toHaveLength(2);
    expect(result[0].labels).toEqual(['gsd', 'M001']);
    expect(result[1].labels).toEqual([]);
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
