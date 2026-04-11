---
marp: true
theme: default
paginate: true
size: 16:9
title: Habbo coding agents
description: Presentation deck for the Habbo coding agents
style: |
  :root {
    --paper: #f5edd9;
    --paper-deep: #efe2bc;
    --ink: #183247;
    --muted: #4d6476;
    --accent: #dd5b38;
    --accent-2: #1b8b72;
    --accent-3: #e7b93e;
    --panel: rgba(255, 250, 237, 0.82);
    --grid: rgba(24, 50, 71, 0.08);
    --shadow: rgba(24, 50, 71, 0.18);
  }

  section {
    font-family: Avenir Next Condensed, Trebuchet MS, sans-serif;
    color: var(--ink);
    background:
      linear-gradient(90deg, transparent 31px, var(--grid) 32px, transparent 33px),
      linear-gradient(transparent 31px, var(--grid) 32px, transparent 33px),
      radial-gradient(circle at top right, #ffe0a2 0%, var(--paper) 40%, var(--paper-deep) 100%);
    background-size: 32px 32px, 32px 32px, auto;
    padding: 52px 64px;
  }

  section::after {
    font-size: 18px;
    color: var(--muted);
    right: 26px;
    bottom: 20px;
  }

  h1,
  h2,
  h3 {
    font-family: Georgia, Times New Roman, serif;
    color: var(--ink);
    letter-spacing: 0.02em;
    margin: 0;
  }

  h1 {
    font-size: 2.35em;
    line-height: 1.02;
  }

  h2 {
    display: inline-block;
    font-size: 1.55em;
    border-bottom: 4px solid var(--accent);
    padding-bottom: 0.1em;
    margin-bottom: 0.45em;
  }

  h3 {
    font-size: 1.04em;
    margin-bottom: 0.25em;
  }

  p,
  li,
  table,
  blockquote {
    font-size: 0.92em;
    line-height: 1.26;
  }

  strong {
    color: var(--accent);
  }

  code {
    font-family: Menlo, Monaco, monospace;
    color: #0d2c3f;
    background: rgba(255, 255, 255, 0.62);
    padding: 0.08em 0.28em;
    border-radius: 0.2em;
  }

  pre {
    background: rgba(255, 249, 236, 0.88);
    border: 2px solid rgba(24, 50, 71, 0.12);
    border-radius: 14px;
    box-shadow: 0 12px 28px -18px var(--shadow);
    padding: 0.7em 0.9em;
  }

  ul,
  ol {
    margin-top: 0.25em;
    padding-left: 1.1em;
  }

  li {
    margin: 0.18em 0;
  }

  blockquote {
    margin: 0.8em 0 0;
    background: var(--panel);
    border-left: 8px solid var(--accent-2);
    border-radius: 0 14px 14px 0;
    padding: 0.55em 0.75em;
    color: var(--ink);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(255, 250, 237, 0.86);
    box-shadow: 0 10px 24px -18px var(--shadow);
  }

  th,
  td {
    padding: 0.4em 0.5em;
    border: 1px solid rgba(24, 50, 71, 0.12);
    text-align: left;
  }

  section.lead {
    justify-content: center;
  }

  section.lead h1 {
    max-width: 11em;
    margin-bottom: 0.18em;
  }

  section.lead p {
    font-size: 1.05em;
    color: var(--muted);
    max-width: 31em;
  }

  .kicker {
    display: inline-block;
    margin-bottom: 0.6em;
    padding: 0.28em 0.6em;
    background: rgba(221, 91, 56, 0.14);
    border: 2px solid rgba(221, 91, 56, 0.32);
    border-radius: 999px;
    color: var(--accent);
    font-size: 0.66em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 1em;
  }

  .chips span {
    display: inline-block;
    padding: 0.25em 0.62em;
    background: rgba(255, 250, 237, 0.92);
    border: 2px solid rgba(24, 50, 71, 0.14);
    border-radius: 999px;
    box-shadow: 0 10px 22px -18px var(--shadow);
    font-size: 0.68em;
    font-weight: 700;
    color: var(--ink);
  }

  .columns {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 26px;
    align-items: start;
  }

  .columns.visual {
    grid-template-columns: 0.95fr 1.05fr;
    align-items: stretch;
  }

  .columns.center {
    align-items: center;
  }

  .columns.center > div {
    text-align: center;
  }

  .panel {
    background: var(--panel);
    border: 2px solid rgba(24, 50, 71, 0.12);
    border-radius: 18px;
    box-shadow: 0 16px 30px -22px var(--shadow);
    padding: 0.75em 0.9em;
  }

  .panel h3 {
    color: var(--accent-2);
  }

  .mini {
    font-size: 0.76em;
    color: var(--muted);
  }

  .mini.bottom {
    position: absolute;
    bottom: 28px;
    left: 64px;
    right: 64px;
  }

  .accent-strip {
    display: inline-block;
    margin-top: 0.7em;
    padding: 0.22em 0.5em;
    background: rgba(231, 185, 62, 0.22);
    border-left: 8px solid var(--accent-3);
    font-weight: 700;
  }

  .shot {
    min-height: 248px;
    display: grid;
    align-content: center;
    gap: 0.45em;
    text-align: center;
    background:
      linear-gradient(135deg, rgba(221, 91, 56, 0.11), rgba(27, 139, 114, 0.09)),
      repeating-linear-gradient(90deg, rgba(24, 50, 71, 0.05) 0 14px, transparent 14px 28px),
      rgba(255, 250, 237, 0.94);
    border: 3px dashed rgba(24, 50, 71, 0.28);
    border-radius: 20px;
    box-shadow: 0 16px 30px -22px var(--shadow);
    padding: 1em 1.1em;
  }

  .shot strong {
    display: block;
    color: var(--accent-2);
    font-size: 0.78em;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .shot p {
    margin: 0;
    color: var(--muted);
    font-size: 0.8em;
    line-height: 1.3;
  }

  .shot.tall {
    min-height: 300px;
  }

  .shot.wide {
    min-height: 180px;
    margin-top: 0.9em;
  }

  .avatar-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .avatar-frame img {
  }
---

<!-- _class: lead -->

<div class="columns center">
<div>

# Habbo-inspired coding agents

</div>

<div class="avatar-frame">

![Habbo avatar](../img/does-anyone-know-the-name-of-this-character-from-habbo-v0-7fujm5oi6zja1.webp)

</div>
</div>

<!-- 
- Visualize coding agent activity as Habbo-style avatars in an isometric room
- Built with TypeScript, React 19, Canvas 2D, esbuild.
- Structured delivery via GSD-2 milestone and slice workflow.
- Copilot agents drive both the product and the development process itself.
-->
---

## My Problem

- Agent work disappears into logs, terminals, PRs, and board state.
- Devs/Teams can see outcomes, but not the live flow of who is doing what.
- This project treats developer orchestration as something worth visualizing.

> The goal is not novelty alone. The goal is operational visibility with a form people instantly understand.

---

## Habbo?

<div class="columns">
<div>

**Habbo Hotel** (2000–present) is a browser-based social game with a distinctive isometric pixel-art style.

- Millions of users built and decorated rooms with modular furniture.
- Avatars are composed from layered sprite parts.
- The aesthetic is **instantly recognizable** and inherently playful.

> This project borrows the visual language: Isometric tiles, avatars, room furniture, to make agent activity feel tangible.

</div>
<div>

![Habbo Hotel: Origins room](../img/8n4khvitdrcd1.png)

</div>
</div>

---



## Show me the Habbo

<div class="columns visual">
<div>

- In this project, Github coding agents appear as animated Habbo-style avatars in an isometric room.
- Name tags, speech bubbles, and sticky notes expose live context.
- Room activity is driven by actual coding-session artifacts.
- Wall notes pull from **GitHub Projects** or **Azure DevOps Boards**.

> The room becomes a visual bridge between agent behavior and project management.

</div>

  ![Room screenshot](../img/Screenshot%202026-04-11%20at%2019.17.49%20(2).png)

</div>

---

## Demo: Azure Boards + GitHub Coding Agent

<div class="columns visual">
<div>

<!-- Speaker notes: 1. Configure board connection in extension settings.
2. Open the Habbo Pixel Agents panel — agents populate from the active session.
3. Wall notes sync live from the connected board.
-->

---

## Retrospective

- Weekend projects are fun again. Copilot lets a solo developer punch well above their weight. Not to mention the with the visuals.
- Structured workflows (GSD-2) begin to move the needle from art towards science.
- Next frontier: voice-driven product development. A copilot present in multi-developer calls, adding live codebase context.

---

## End*

---

## Q&A: Delivery: GSD-2 Workflow

<div class="columns">
<div class="panel">

### Shape

- Every task goes through the GSD workflow — milestones → slices → tasks.
- Copilot agents execute slices via `gsd-cli`, driven by the `pi` coding-agent harness.

</div>
<div class="panel">

### Modes

- **Step** — one unit at a time, human in the loop.
- **Auto** — research, plan, execute, commit autonomously.
- **Discuss / Status** — architecture decisions & progress dashboard.

</div>
</div>

<p class="mini bottom">This is a Copilot-driven project, but not an ad hoc one. Work is structured, tracked, and verifiable.</p>

---

## Q&A: Visual assets: PixelLab

- PixelLab is an AI Pixel art generator service. Provides an MCP + easier walking animation support, which is why it was chosen over Retrodiffusion (my favourite)
- Easy to export assets and give instructions for copilot to give you the end result.