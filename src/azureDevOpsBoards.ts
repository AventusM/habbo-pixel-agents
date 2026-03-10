// src/azureDevOpsBoards.ts
// Azure DevOps Boards data fetching via REST API
// Follows the silent-fallback pattern: any error returns [] instead of throwing

import type { KanbanCard } from './agentTypes.js';

/** Map Azure DevOps work item state to kanban status */
export function mapAzureDevOpsState(state: string): string {
  const TODO = ['New', 'Proposed', 'Approved', 'To Do'];
  const IN_PROGRESS = ['Active', 'Committed', 'In Progress', 'Doing'];
  const DONE_STATES = ['Resolved', 'Done', 'Closed'];
  if (TODO.includes(state)) return 'To Do';
  if (IN_PROGRESS.includes(state)) return 'Doing';
  if (DONE_STATES.includes(state)) return 'Done';
  if (state === 'Removed') return 'Removed';
  return 'No Status';
}

/**
 * Fetch work items from Azure DevOps Boards REST API.
 * Uses the two-step WIQL → workitemsbatch pattern.
 * Returns an empty array on any error (network, auth, empty config).
 */
export async function fetchAzureDevOpsCards(
  organization: string,
  project: string,
  pat: string,
): Promise<KanbanCard[]> {
  if (!organization || !project || !pat) {
    return [];
  }

  try {
    const authHeader = `Basic ${Buffer.from(':' + pat).toString('base64')}`;
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    // Step 1: POST WIQL query to get work item IDs
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.1`;
    const wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`;

    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: wiqlQuery }),
    });

    if (!wiqlResponse.ok) {
      console.error('[azureDevOpsBoards] fetchAzureDevOpsCards failed: WIQL response', wiqlResponse.status);
      return [];
    }

    const wiqlData = await wiqlResponse.json() as { workItems: Array<{ id: number }> };
    const workItemIds = wiqlData.workItems.map((wi) => wi.id);

    if (workItemIds.length === 0) {
      return [];
    }

    // Step 2: POST to workitemsbatch to get details (cap at 100)
    const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitemsbatch?api-version=7.1`;
    const batchResponse = await fetch(batchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ids: workItemIds.slice(0, 100),
        fields: ['System.Id', 'System.Title', 'System.State'],
      }),
    });

    if (!batchResponse.ok) {
      console.error('[azureDevOpsBoards] fetchAzureDevOpsCards failed: batch response', batchResponse.status);
      return [];
    }

    const batchData = await batchResponse.json() as {
      value: Array<{
        id: number;
        fields: {
          'System.Id': number;
          'System.Title': string;
          'System.State': string;
        };
      }>;
    };

    return batchData.value
      .map((item) => ({
        id: String(item.fields['System.Id']),
        title: item.fields['System.Title'] ?? '(no title)',
        status: mapAzureDevOpsState(item.fields['System.State']),
      }))
      .filter((card) => card.status !== 'Removed');
  } catch (err) {
    console.error('[azureDevOpsBoards] fetchAzureDevOpsCards failed:', err);
    return [];
  }
}
