// src/azureDevOpsBoards.ts
// Azure DevOps Boards data fetching via REST API
// Follows the silent-fallback pattern: any error returns [] instead of throwing

import type { KanbanCard, KanbanCardChild, KanbanCardPr } from './agentTypes.js';

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

/** Check if a state represents a completed work item */
function isCompletedState(state: string): boolean {
  return ['Resolved', 'Done', 'Closed'].includes(state);
}

/**
 * Fetch work item details by IDs in batches.
 * Returns raw work item objects with requested fields.
 */
async function fetchWorkItemsBatch(
  organization: string,
  ids: number[],
  fields: string[],
  authHeader: string,
): Promise<Array<{ id: number; fields: Record<string, unknown> }>> {
  if (ids.length === 0) return [];

  const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitemsbatch?api-version=7.1`;
  const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json' };

  const response = await fetch(batchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: ids.slice(0, 200), fields }),
  });

  if (!response.ok) return [];

  const data = await response.json() as { value: Array<{ id: number; fields: Record<string, unknown> }> };
  return data.value || [];
}

/**
 * Fetch work item relations (children, linked PRs) for a single work item.
 */
async function fetchWorkItemRelations(
  organization: string,
  project: string,
  workItemId: number,
  authHeader: string,
): Promise<{ children: KanbanCardChild[]; linkedPrs: KanbanCardPr[] }> {
  const children: KanbanCardChild[] = [];
  const linkedPrs: KanbanCardPr[] = [];

  try {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.1`;
    const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json' };

    const response = await fetch(url, { headers });
    if (!response.ok) return { children, linkedPrs };

    const data = await response.json() as {
      relations?: Array<{
        rel: string;
        url: string;
        attributes?: { name?: string };
      }>;
    };

    if (!data.relations) return { children, linkedPrs };

    // Collect child work item IDs
    const childIds: number[] = [];
    for (const rel of data.relations) {
      if (rel.rel === 'System.LinkTypes.Hierarchy-Forward') {
        // Child work item — extract ID from URL
        const match = rel.url.match(/workItems\/(\d+)$/);
        if (match) childIds.push(parseInt(match[1], 10));
      } else if (rel.rel === 'ArtifactLink' && rel.url.includes('PullRequestId')) {
        // Linked pull request
        const prMatch = rel.url.match(/PullRequestId\/(\d+)/);
        linkedPrs.push({
          id: prMatch?.[1] || 'unknown',
          title: rel.attributes?.name || `PR #${prMatch?.[1] || '?'}`,
          status: 'active', // Would need separate PR API call for actual status
          url: rel.url,
        });
      }
    }

    // Fetch child work item details
    if (childIds.length > 0) {
      const childItems = await fetchWorkItemsBatch(
        organization, childIds,
        ['System.Id', 'System.Title', 'System.State'],
        authHeader,
      );
      for (const item of childItems) {
        const state = (item.fields['System.State'] as string) || 'New';
        children.push({
          id: String(item.fields['System.Id'] || item.id),
          title: (item.fields['System.Title'] as string) || '(no title)',
          state,
          completed: isCompletedState(state),
        });
      }
    }
  } catch (err) {
    console.warn(`[azureDevOpsBoards] fetchWorkItemRelations failed for ${workItemId}:`, err);
  }

  return { children, linkedPrs };
}

/**
 * Fetch work items from Azure DevOps Boards REST API.
 * Uses the two-step WIQL → workitemsbatch pattern.
 * Optionally fetches child work items and linked PRs for each card.
 * Returns an empty array on any error (network, auth, empty config).
 */
export async function fetchAzureDevOpsCards(
  organization: string,
  project: string,
  pat: string,
  options?: { includeRelations?: boolean },
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
    const batchItems = await fetchWorkItemsBatch(
      organization,
      workItemIds.slice(0, 100),
      [
        'System.Id', 'System.Title', 'System.State',
        'System.WorkItemType', 'System.AssignedTo',
      ],
      authHeader,
    );

    const cards: KanbanCard[] = batchItems
      .map((item) => {
        const assignedTo = item.fields['System.AssignedTo'] as
          | { displayName?: string; uniqueName?: string }
          | string
          | undefined;
        let assignee: string | undefined;
        if (typeof assignedTo === 'object' && assignedTo?.displayName) {
          assignee = assignedTo.displayName;
        } else if (typeof assignedTo === 'string') {
          assignee = assignedTo;
        }

        return {
          id: String(item.fields['System.Id'] ?? item.id),
          title: (item.fields['System.Title'] as string) ?? '(no title)',
          status: mapAzureDevOpsState((item.fields['System.State'] as string) || ''),
          workItemType: (item.fields['System.WorkItemType'] as string) || undefined,
          assignee,
        };
      })
      .filter((card) => card.status !== 'Removed');

    // Step 3 (optional): Fetch relations for each card
    if (options?.includeRelations) {
      // Limit to in-progress items to avoid too many API calls
      const inProgress = cards.filter(c => c.status === 'Doing');
      const toEnrich = inProgress.length > 0 ? inProgress : cards.slice(0, 10);

      await Promise.all(toEnrich.map(async (card) => {
        const { children, linkedPrs } = await fetchWorkItemRelations(
          organization, project, parseInt(card.id, 10), authHeader,
        );
        card.children = children.length > 0 ? children : undefined;
        card.linkedPrs = linkedPrs.length > 0 ? linkedPrs : undefined;
      }));
    }

    return cards;
  } catch (err) {
    console.error('[azureDevOpsBoards] fetchAzureDevOpsCards failed:', err);
    return [];
  }
}
