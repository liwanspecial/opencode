# Markdown Link Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-clicking URL and file/path references in assistant Markdown should offer useful copy/open/reveal actions and copy the actual target, not `oc://renderer/index.html#`.

**Architecture:** Fix the root bug by avoiding `href="#"` for trusted file references and preserving the real target in attributes. Add a small Markdown-scoped custom context menu in `@opencode-ai/session-ui` that reads `data-markdown-href`, `data-file-path`, and inline code metadata, then calls optional callbacks supplied by the app/Desktop platform.

**Tech Stack:** SolidJS DOM post-processing, session-ui Markdown utilities, Desktop preload `openPath`/`revealPath`, Bun tests/typecheck, Electron build/package.

## Global Constraints

- Do not hardcode new production UI copy without i18n where app/session-ui i18n APIs are available.
- Keep the feature scoped to assistant Markdown content, not global browser context menus.
- Do not break existing file-link click behavior.

---

### Task 1: Fix File Link Copy Target

**Files:**
- Modify: `packages/session-ui/src/components/markdown.tsx`
- Test: `packages/app/src/pages/session/markdown-file-reference.test.tsx`

**Interfaces:**
- Consumes: `decorateMarkdownFileReferences(root, onFileOpen, linkCapability)`
- Produces: file anchors with `href` set to the actual path value, while click handling still opens through `setupMarkdownFileClicks`

- [ ] **Step 1: Write failing test**

Update the existing explicit file link test expectation from `href="#"` to an encoded real path URL value:

```ts
expect(link.getAttribute("href")).toBe("C:/repo/My%20Project/%E5%BA%94%E7%94%A8.tsx:12")
```

- [ ] **Step 2: Run test to verify failure**

Run from `packages/app`: `bun test src/pages/session/markdown-file-reference.test.tsx`

Expected: FAIL because current implementation sets `href="#"`.

- [ ] **Step 3: Implement minimal fix**

In `decorateMarkdownFileReferences`, replace `anchor.setAttribute("href", "#")` with `anchor.setAttribute("href", anchor.dataset.markdownHref ?? reference.path)`.

- [ ] **Step 4: Run test to verify pass**

Run from `packages/app`: `bun test src/pages/session/markdown-file-reference.test.tsx`

Expected: PASS.

### Task 2: Add Markdown Context Menu Hook

**Files:**
- Modify: `packages/session-ui/src/components/markdown.tsx`
- Test: `packages/app/src/pages/session/markdown-file-reference.test.tsx`

**Interfaces:**
- Produces: `setupMarkdownContextMenu(root, opts)` exported from `@opencode-ai/session-ui/markdown`
- `opts.copy(value: string): void | Promise<void>`
- `opts.openExternal?(url: string): void | Promise<void>`
- `opts.openPath?(path: string): void | Promise<void>`
- `opts.revealPath?(path: string): void | Promise<void>`

- [ ] **Step 1: Write failing tests**

Add tests that dispatch a `contextmenu` event on:
- external link with `data-markdown-href="https://opencode.ai"`, expecting target `https://opencode.ai`
- file link with `data-file-path="C:/repo/app.ts"`, expecting target `C:/repo/app.ts`
- inline code path `src/app.tsx`, expecting target `src/app.tsx`

- [ ] **Step 2: Run tests to verify failure**

Run from `packages/app`: `bun test src/pages/session/markdown-file-reference.test.tsx`
Expected: FAIL because `setupMarkdownContextMenu` is not implemented/exported.

- [ ] **Step 3: Implement DOM-scoped context menu event handler**

Add `setupMarkdownContextMenu(root, opts)` in `markdown.tsx`. It should find the closest actionable element from `event.target`, prevent default only for actionable Markdown references, and render a small absolute menu inside `root`.

- [ ] **Step 4: Implement menu actions**

Menu items:
- URL: copy target, open target
- file/path: copy path, open path, reveal path

- [ ] **Step 5: Run tests to verify pass**

Run from `packages/app`: `bun test src/pages/session/markdown-file-reference.test.tsx`
Expected: PASS.

### Task 3: Wire Desktop Platform Actions

**Files:**
- Modify: call site that renders `Markdown` in app/session message components, most likely `packages/session-ui/src/components/message-part.tsx` or app wrapper depending on existing platform access
- Modify: `packages/session-ui/src/components/markdown.css`

**Interfaces:**
- Consumes: `window.api.openExternal`, `window.api.openPath`, `window.api.revealPath`, and `navigator.clipboard.writeText`

- [ ] **Step 1: Wire callbacks**

Pass context-menu callbacks from Desktop/app platform to `Markdown` or install them where Markdown roots are mounted.

- [ ] **Step 2: Style menu**

Add `[data-component="markdown-context-menu"]` and item styles consistent with existing compact menus.

- [ ] **Step 3: Verify package checks**

Run `bun test src` and `bun typecheck` in `packages/session-ui`, `bun test src/pages/session/markdown-file-reference.test.tsx` in `packages/app`, and `bun typecheck` in `packages/desktop`.

### Task 4: Build Installer

**Files:**
- No source edits expected.

- [ ] **Step 1: Build renderer**

Run from `packages/desktop`: `$env:OPENCODE_CHANNEL='prod'; bun run build`.

- [ ] **Step 2: Confirm bundled markers**

Search `packages/desktop/out/renderer` for `markdown-context-menu`.

- [ ] **Step 3: Build installer**

Run from `packages/desktop`: `$env:OPENCODE_CHANNEL='prod'; bun run package:win`.
