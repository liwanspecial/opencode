# Review Pane Resize Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the session/review divider to move farther right by reducing the minimum width reserved for unified and split review panes.

**Architecture:** Preserve the existing resize handle, one-to-one drag calculation, persisted session width, and render-time clamping. Change only the two review-pane minimum constants consumed by `sessionPanelWidthMax`, with focused tests proving the new limits and unchanged session minimum behavior.

**Tech Stack:** TypeScript, SolidJS layout utilities, Bun test runner

## Global Constraints

- Unified diff review pane minimum: `360px`.
- Split diff review pane minimum: `640px`.
- Session panel minimum remains `450px`.
- Do not alter the review file-list sidebar, drag sensitivity, width persistence, responsive breakpoint, or panel rendering.
- Run tests and type checking from `packages/app`, never from the repository root.

---

### Task 1: Expand the divider's rightward range

**Files:**
- Modify: `packages/app/src/pages/session/session-panel-width.ts:5-7`
- Test: `packages/app/src/pages/session/session-panel-width.test.ts:10-30`

**Interfaces:**
- Consumes: `sessionPanelWidthMax(input: { available: number; split: boolean }): number`
- Produces: `REVIEW_PANE_WIDTH_MIN = 360` and `REVIEW_PANE_WIDTH_MIN_SPLIT = 640`; the existing exported function and parameter types remain unchanged.

- [x] **Step 1: Write failing assertions for the new limits**

Add explicit constant assertions to the existing unified and split tests:

```ts
test("reserves the unified review pane minimum", () => {
  expect(REVIEW_PANE_WIDTH_MIN).toBe(360)
  expect(sessionPanelWidthMax({ available: 1700, split: false })).toBe(1700 - REVIEW_PANE_WIDTH_MIN)
})

test("reserves a larger minimum for split diffs", () => {
  expect(REVIEW_PANE_WIDTH_MIN_SPLIT).toBe(640)
  expect(sessionPanelWidthMax({ available: 1700, split: true })).toBe(1700 - REVIEW_PANE_WIDTH_MIN_SPLIT)
  expect(REVIEW_PANE_WIDTH_MIN_SPLIT).toBeGreaterThan(REVIEW_PANE_WIDTH_MIN)
})
```

- [x] **Step 2: Run the focused test and verify RED**

Run from `packages/app`:

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: FAIL because `REVIEW_PANE_WIDTH_MIN` is still `480` and `REVIEW_PANE_WIDTH_MIN_SPLIT` is still `800`.

- [x] **Step 3: Implement the new minimum widths**

Update only the constants in `session-panel-width.ts`:

```ts
export const SESSION_PANEL_WIDTH_MIN = 450
export const REVIEW_PANE_WIDTH_MIN = 360
export const REVIEW_PANE_WIDTH_MIN_SPLIT = 640
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run from `packages/app`:

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: all tests in the file PASS, including small-window clamping to `SESSION_PANEL_WIDTH_MIN`.

- [x] **Step 5: Run package type checking**

Run from `packages/app`:

```bash
bun typecheck
```

Expected: command exits successfully with no TypeScript errors.

- [x] **Step 6: Review and commit the implementation**

```bash
git diff --check
git diff -- packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts
git add packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts docs/superpowers/plans/2026-08-07-review-pane-resize-range.md
git commit -m "fix(app): 扩大审查栏向右调节范围"
```
