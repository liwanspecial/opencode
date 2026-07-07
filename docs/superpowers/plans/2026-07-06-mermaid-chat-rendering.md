# Mermaid Chat Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `mermaid` fenced code blocks as diagrams by default in the Desktop chat panel, with a toggle back to source code.

**Architecture:** The Desktop chat panel uses `@opencode-ai/session-ui` Markdown rendering, so the implementation belongs in `packages/session-ui/src/components/markdown.tsx`. Keep normal code blocks on the existing highlighting/copy path and intercept only Mermaid code blocks during code-block DOM post-processing.

**Tech Stack:** SolidJS, marked/shiki Markdown pipeline, Mermaid dynamic import, Bun package scripts.

---

### Task 1: Add Mermaid Dependency

**Files:**
- Modify: `packages/session-ui/package.json`

- [ ] **Step 1: Add dependency**

Add `"mermaid": "catalog:"` to `dependencies` if a catalog entry exists, otherwise add a concrete current version.

- [ ] **Step 2: Install/update lockfile**

Run: `bun install`

Expected: dependency resolves and `bun.lock` updates if needed.

### Task 2: Render Mermaid Blocks

**Files:**
- Modify: `packages/session-ui/src/components/markdown.tsx`

- [ ] **Step 1: Detect Mermaid language**

Add a case-insensitive check for code block language `mermaid` near existing `codeLanguage` metadata handling.

- [ ] **Step 2: Add a focused Solid component**

Create a small `MarkdownMermaidBlock` component in the same file. It should dynamically import `mermaid`, initialize it with safe defaults, render SVG into a container, and keep local `diagram`/`code` state.

- [ ] **Step 3: Mount Mermaid component during code wrapping**

When `ensureCodeWrapper` sees a Mermaid block, replace the normal code wrapper contents with a Mermaid host and skip copy-button insertion. Keep non-Mermaid blocks unchanged.

- [ ] **Step 4: Dispose mounted components**

Track Mermaid hosts similarly to copy-button hosts so morphdom updates and component unmounts dispose Solid roots cleanly.

### Task 3: Style Mermaid Blocks

**Files:**
- Modify: `packages/session-ui/src/components/markdown.css`

- [ ] **Step 1: Add diagram container styles**

Add styles for `[data-component="markdown-mermaid"]`, the top-right toggle button slot, diagram overflow, source view, and error state.

- [ ] **Step 2: Preserve spacing**

Match existing code block margins and border radius so Mermaid blocks fit the current chat typography.

### Task 4: Add Story Coverage

**Files:**
- Modify: `packages/session-ui/src/components/markdown.stories.tsx`

- [ ] **Step 1: Add Mermaid story**

Add a story whose Markdown contains a `mermaid` code fence and a normal code fence to validate the selective rendering path visually.

### Task 5: Verify

**Files:**
- No source edits expected.

- [ ] **Step 1: Typecheck session-ui**

Run from `packages/session-ui`: `bun typecheck`

Expected: command exits successfully.

- [ ] **Step 2: Run session-ui tests**

Run from `packages/session-ui`: `bun test src`

Expected: command exits successfully or reports only unrelated pre-existing failures.

- [ ] **Step 3: Optional Desktop smoke check**

Run from repo root: `bun run dev:desktop`

Expected: Desktop starts; a chat response containing a Mermaid block renders a diagram by default and toggles to source.
