#!/usr/bin/env bash
# Creates an "AI Agent Task" work item template in Azure DevOps
# via the REST API (v7.1).
#
# Usage:
#   ./scripts/create-ado-template.sh <org> <project> <team> <pat>
#
# Example:
#   ./scripts/create-ado-template.sh myorg MyProject "MyProject Team" ghp_xxxx...
#
# The PAT needs the vso.work_write scope.

set -euo pipefail

if [ $# -lt 4 ]; then
  echo "Usage: $0 <organization> <project> <team> <pat>"
  echo ""
  echo "  organization  Azure DevOps org name (from dev.azure.com/{org})"
  echo "  project       Project name or ID"
  echo "  team          Team name or ID"
  echo "  pat           Personal Access Token with vso.work_write scope"
  exit 1
fi

ORG="$1"
PROJECT="$2"
TEAM="$3"
PAT="$4"

# URL-encode spaces in project/team names
PROJECT_ENC=$(printf '%s' "$PROJECT" | sed 's/ /%20/g')
TEAM_ENC=$(printf '%s' "$TEAM" | sed 's/ /%20/g')

URL="https://dev.azure.com/${ORG}/${PROJECT_ENC}/${TEAM_ENC}/_apis/wit/templates?api-version=7.1"

# HTML for the Description field — the main template body
read -r -d '' DESCRIPTION_HTML << 'HTMLEOF' || true
<h2>Title: [Verb] [specific thing] in [specific place]</h2>

<h3>Context</h3>
<p><em>[1-2 sentences: why this matters, what triggered it. Include a metric or user complaint if available.]</em></p>

<h3>Test spec</h3>

<p><strong>E2E</strong> (<code>tests/e2e/[name].spec.ts</code>):</p>
<ol>
  <li>[Navigate to page, wait for load]</li>
  <li>[Perform user action]</li>
  <li>[Assert: expected outcome with concrete values]</li>
  <li>[Perform second action or edge case]</li>
  <li>[Assert: expected outcome]</li>
</ol>

<p><strong>Visual regression</strong> (<code>tests/visual/[name].spec.ts</code>):</p>
<ul>
  <li>[Which component states to snapshot: default, hover, loading, error, empty]</li>
  <li>[What to look for in each state]</li>
</ul>

<p><strong>Unit tests</strong> (<code>tests/unit/[name].test.ts</code>):</p>
<ul>
  <li>[Edge case 1 → expected behavior]</li>
  <li>[Edge case 2 → expected behavior]</li>
  <li>[Edge case 3 → expected behavior]</li>
</ul>

<h3>Key files</h3>
<ul>
  <li><code>src/path/to/file.ts</code> → <code>functionName()</code> — [what it does now]</li>
  <li><code>src/path/to/other.ts</code> → <code>TypeOrHook</code> — [what it does now]</li>
</ul>

<h3>Blast radius</h3>
<ul>
  <li><strong>May modify:</strong> <code>[file paths the agent is allowed to change]</code></li>
  <li><strong>May create:</strong> <code>[new test files and any new source files]</code></li>
  <li><strong>Must not touch:</strong> <code>[auth/*, migrations/*, package.json, etc.]</code></li>
</ul>

<h3>Constraints</h3>
<ul>
  <li>[Don't break X — downstream dependency reason]</li>
  <li>[Use existing Y — don't create a parallel abstraction]</li>
  <li>[Must use parameterized queries / no string interpolation / etc.]</li>
  <li>⚠️ [Anti-pattern to avoid: don't wrap in try/catch to suppress, don't mock in E2E, etc.]</li>
</ul>
HTMLEOF

# HTML for the Acceptance Criteria field — the "Done When" checklist
read -r -d '' ACCEPTANCE_HTML << 'HTMLEOF' || true
<ul>
  <li>☐ All test specs above are implemented and passing in CI</li>
  <li>☐ E2E tests green: <code>[npm run test:e2e -- --filter=name]</code></li>
  <li>☐ Visual regression green: <code>[npm run test:visual]</code>, new baselines committed</li>
  <li>☐ Unit tests green: <code>[npm run test:unit -- --filter=name]</code></li>
  <li>☐ Existing tests unbroken: <code>[npm test]</code></li>
  <li>☐ No new lint or type-check warnings</li>
</ul>
HTMLEOF

# Escape the HTML for JSON embedding
DESCRIPTION_JSON=$(printf '%s' "$DESCRIPTION_HTML" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
ACCEPTANCE_JSON=$(printf '%s' "$ACCEPTANCE_HTML" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

# Build the JSON payload
PAYLOAD=$(cat <<JSONEOF
{
  "name": "AI Agent Task",
  "description": "Template for work items assigned to AI coding agents. Tests-first structure with blast radius, constraints, and CI-enforceable acceptance criteria.",
  "workItemTypeName": "Issue",
  "fields": {
    "System.Description": ${DESCRIPTION_JSON},
    "Microsoft.VSTS.Common.AcceptanceCriteria": ${ACCEPTANCE_JSON}
  }
}
JSONEOF
)

echo "Creating template in: ${ORG}/${PROJECT}/${TEAM}"
echo "URL: ${URL}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -u ":${PAT}" \
  "${URL}" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✅ Template created successfully (HTTP ${HTTP_CODE})"
  echo ""
  echo "Template details:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  echo ""
  echo "To use: New Work Item → ⋯ menu → Templates → AI Agent Task"
else
  echo "❌ Failed to create template (HTTP ${HTTP_CODE})"
  echo ""
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
