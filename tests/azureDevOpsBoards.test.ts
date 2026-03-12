// tests/azureDevOpsBoards.test.ts
// Unit tests for Azure DevOps Boards data-fetching module

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAzureDevOpsCards, mapAzureDevOpsState } from '../src/azureDevOpsBoards.js';

// Helper to build a mock Response object
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// Minimal WIQL response with work item IDs
function buildWiqlResponse(ids: number[]) {
  return {
    workItems: ids.map((id) => ({ id })),
  };
}

// Minimal batch response with work items
function buildBatchResponse(items: Array<{ id: number; title: string; state: string }>) {
  return {
    value: items.map((item) => ({
      id: item.id,
      fields: {
        'System.Id': item.id,
        'System.Title': item.title,
        'System.State': item.state,
      },
    })),
  };
}

describe('mapAzureDevOpsState', () => {
  it('maps Todo states correctly', () => {
    expect(mapAzureDevOpsState('New')).toBe('To Do');
    expect(mapAzureDevOpsState('Proposed')).toBe('To Do');
    expect(mapAzureDevOpsState('Approved')).toBe('To Do');
  });

  it('maps In Progress states correctly', () => {
    expect(mapAzureDevOpsState('Active')).toBe('Doing');
    expect(mapAzureDevOpsState('Committed')).toBe('Doing');
    expect(mapAzureDevOpsState('In Progress')).toBe('Doing');
  });

  it('maps Done states correctly', () => {
    expect(mapAzureDevOpsState('Resolved')).toBe('Done');
    expect(mapAzureDevOpsState('Done')).toBe('Done');
    expect(mapAzureDevOpsState('Closed')).toBe('Done');
  });

  it('maps Removed state correctly', () => {
    expect(mapAzureDevOpsState('Removed')).toBe('Removed');
  });

  it('maps unknown states to No Status', () => {
    expect(mapAzureDevOpsState('SomeCustomState')).toBe('No Status');
    expect(mapAzureDevOpsState('')).toBe('No Status');
    expect(mapAzureDevOpsState('WhateverElse')).toBe('No Status');
  });
});

describe('fetchAzureDevOpsCards', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] on empty organization', async () => {
    const result = await fetchAzureDevOpsCards('', 'myProject', 'myPat');
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] on empty project', async () => {
    const result = await fetchAzureDevOpsCards('myOrg', '', 'myPat');
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] on empty pat', async () => {
    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', '');
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] when fetch throws (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');
    expect(result).toEqual([]);
  });

  it('returns [] on 401 Unauthorized', async () => {
    fetchMock.mockResolvedValue(mockResponse({}, false, 401));

    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');
    expect(result).toEqual([]);
  });

  it('returns [] when WIQL response has 0 work items and does not call batch', async () => {
    fetchMock.mockResolvedValue(mockResponse(buildWiqlResponse([])));

    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');

    expect(result).toEqual([]);
    // Only 1 fetch call (WIQL), no batch call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses batch response into KanbanCard[]', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(buildWiqlResponse([101, 102])))
      .mockResolvedValueOnce(
        mockResponse(
          buildBatchResponse([
            { id: 101, title: 'Fix auth bug', state: 'Active' },
            { id: 102, title: 'Add new feature', state: 'New' },
          ])
        )
      );

    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '101', title: 'Fix auth bug', status: 'Doing' });
    expect(result[1]).toEqual({ id: '102', title: 'Add new feature', status: 'To Do' });
  });

  it('slices IDs to max 100 before batch call', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    fetchMock
      .mockResolvedValueOnce(mockResponse(buildWiqlResponse(ids)))
      .mockResolvedValueOnce(
        mockResponse(
          buildBatchResponse(
            ids.slice(0, 100).map((id) => ({ id, title: `Task ${id}`, state: 'Active' }))
          )
        )
      );

    await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');

    // Check the second call (batch) has only 100 IDs
    const batchCall = fetchMock.mock.calls[1];
    const batchBody = JSON.parse(batchCall[1].body as string) as { ids: number[] };
    expect(batchBody.ids).toHaveLength(100);
    expect(batchBody.ids[0]).toBe(1);
    expect(batchBody.ids[99]).toBe(100);
  });

  it('filters out Removed items from batch response', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(buildWiqlResponse([201, 202, 203])))
      .mockResolvedValueOnce(
        mockResponse(
          buildBatchResponse([
            { id: 201, title: 'Active task', state: 'Active' },
            { id: 202, title: 'Removed task', state: 'Removed' },
            { id: 203, title: 'Done task', state: 'Done' },
          ])
        )
      );

    const result = await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');

    expect(result).toHaveLength(2);
    expect(result.find((c) => c.title === 'Removed task')).toBeUndefined();
  });

  it('sends correct Authorization header with PAT', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(buildWiqlResponse([])));

    await fetchAzureDevOpsCards('myOrg', 'myProject', 'secret-pat');

    const firstCall = fetchMock.mock.calls[0];
    const requestInit = firstCall[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    const expectedToken = Buffer.from(':secret-pat').toString('base64');
    expect(headers['Authorization']).toBe(`Basic ${expectedToken}`);
  });

  it('sends WIQL to correct URL', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(buildWiqlResponse([])));

    await fetchAzureDevOpsCards('myOrg', 'myProject', 'myPat');

    const firstCallUrl = fetchMock.mock.calls[0][0] as string;
    expect(firstCallUrl).toBe(
      'https://dev.azure.com/myOrg/myProject/_apis/wit/wiql?api-version=7.1'
    );
  });
});
