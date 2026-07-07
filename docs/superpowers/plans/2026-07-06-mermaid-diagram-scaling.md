# Mermaid Diagram Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered Mermaid diagrams smaller by default and add per-diagram zoom controls.

**Architecture:** Keep the feature inside `packages/session-ui/src/components/markdown.tsx` where Mermaid diagrams are rendered. Add local zoom state to `MarkdownMermaidBlock`, render a compact toolbar, and style the SVG wrapper so diagrams default to 75% without affecting source-code mode.

**Tech Stack:** SolidJS, CSS, Bun tests/typecheck, Electron desktop build.

---

### Task 1: Add Zoom State And Controls

**Files:**
- Modify: `packages/session-ui/src/components/markdown.tsx`

- [ ] **Step 1: Add zoom state**

Add a `scales` array `[0.5, 0.75, 1, 1.25, 1.5]`, a `scaleIndex` signal defaulting to `1`, and a `scale` accessor in `MarkdownMermaidBlock`.

- [ ] **Step 2: Replace the single toggle button with a toolbar**

In diagram mode render `-`, current percent, `+`, and `Code` buttons. In source mode render only `Diagram`.

- [ ] **Step 3: Apply scale to the diagram wrapper**

Set CSS custom property `--markdown-mermaid-scale` on the diagram element to the selected scale.

### Task 2: Style Scaled Diagrams

**Files:**
- Modify: `packages/session-ui/src/components/markdown.css`

- [ ] **Step 1: Replace toggle styles with toolbar/button styles**

Style `[data-slot="markdown-mermaid-toolbar"]` and `[data-slot="markdown-mermaid-button"]` using the same compact visual language as the current button.

- [ ] **Step 2: Add scaling rules**

Wrap Mermaid SVG contents with `transform: scale(var(--markdown-mermaid-scale)); transform-origin: top center; width: calc(100% / var(--markdown-mermaid-scale));` so scaled-down diagrams occupy less visual space while remaining centered.

### Task 3: Verify And Package

**Files:**
- No source edits expected.

- [ ] **Step 1: Run tests and typechecks**

Run `bun test src` and `bun typecheck` in `packages/session-ui`, then `bun typecheck` in `packages/desktop`.

- [ ] **Step 2: Rebuild renderer before packaging**

Run from `packages/desktop`: `$env:OPENCODE_CHANNEL='prod'; bun run build`.

- [ ] **Step 3: Confirm bundled markers exist**

Search `packages/desktop/out/renderer` for `markdown-mermaid-toolbar` and `--markdown-mermaid-scale`.

- [ ] **Step 4: Build Windows installer**

Run from `packages/desktop`: `$env:OPENCODE_CHANNEL='prod'; bun run package:win`.
