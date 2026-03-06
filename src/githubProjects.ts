// src/githubProjects.ts
// GitHub Projects v2 data fetching via gh CLI
// Follows the silent-fallback pattern: any error returns [] instead of throwing

import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { KanbanCard } from './agentTypes.js';

/**
 * Fetch kanban cards from a GitHub Projects v2 board via the gh CLI.
 * Returns an empty array on any error (gh not installed, auth failure, network error).
 */
export function fetchKanbanCards(
  owner: string,
  projectNumber: number,
  ownerType: 'org' | 'user' = 'org'
): KanbanCard[] {
  try {
    // Step 1: Get the project node ID
    const ownerField = ownerType === 'org'
      ? `organization(login: "${owner}")`
      : `user(login: "${owner}")`;

    const idQuery = `
      query {
        ${ownerField} {
          projectV2(number: ${projectNumber}) {
            id
          }
        }
      }
    `;

    const idResult = execFileSync(
      'gh',
      ['api', 'graphql', '-f', `query=${idQuery}`],
      { encoding: 'utf8' }
    );

    const idData = JSON.parse(idResult) as {
      data: {
        organization?: { projectV2: { id: string } };
        user?: { projectV2: { id: string } };
      };
    };

    const ownerData = idData.data.organization ?? idData.data.user;
    if (!ownerData) {
      return [];
    }
    const projectId = ownerData.projectV2.id;

    // Step 2: Fetch items using the project node ID
    // Write query to temp file to avoid shell quoting issues with complex GraphQL
    const itemsQuery = `
      query {
        node(id: "${projectId}") {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    title
                  }
                  ... on PullRequest {
                    title
                  }
                  ... on DraftIssue {
                    title
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const tmpFile = join(tmpdir(), `gh-kanban-query-${Date.now()}.json`);
    try {
      writeFileSync(tmpFile, JSON.stringify({ query: itemsQuery }));
      const itemsResult = execFileSync(
        'gh',
        ['api', 'graphql', '--input', tmpFile],
        { encoding: 'utf8' }
      );

      const itemsData = JSON.parse(itemsResult) as {
        data: {
          node: {
            items: {
              nodes: Array<{
                id: string;
                content: { title?: string | null } | null;
                fieldValues: {
                  nodes: Array<{
                    name?: string;
                    field?: { name?: string };
                  }>;
                };
              }>;
            };
          };
        };
      };

      const items = itemsData.data.node.items.nodes;

      return items.map((item) => {
        const title = item.content?.title ?? '(no title)';

        // Find the Status field value
        const statusFieldValue = item.fieldValues.nodes.find(
          (fv) => fv.field?.name === 'Status'
        );
        const status = statusFieldValue?.name ?? 'No Status';

        return { id: item.id, title, status };
      });
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    console.error('[githubProjects] fetchKanbanCards failed:', err);
    return [];
  }
}
