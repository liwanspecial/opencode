# Review Pane Reopen Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every desktop review-pane reopen display a `480px` right pane, including when an upgrade left a full-width session value in persistent storage.

**Architecture:** Add a pure helper that converts the desired `480px` review width into the persisted left session width while preserving the `450px` session minimum. Observe the single closed-to-open review state transition in the session page, so header buttons, keyboard commands, file references, and context actions all use the same behavior without changing each caller.

**Tech Stack:** TypeScript, SolidJS, Bun test runner, Playwright

## Global Constraints

- Every desktop review closed-to-open transition restores a `480px` right pane.
- Session width remains at least `450px` on smaller desktop rows.
- Once open, review remains freely resizable and can still be dragged to `0%` to close.
- Terminal-only sizing, file-tree sizing, internal review-sidebar sizing, mobile behavior, and generic `ResizeHandle` behavior remain unchanged.
- Run tests and type checking from `packages/app`, never from the repository root.
- Record the focused production review benchmark before and after changing session code.

---

### Task 1: Calculate the session width for a 480px reopened review pane

**Files:**
- Modify: `packages/app/src/pages/session/session-panel-width.test.ts`
- Modify: `packages/app/src/pages/session/session-panel-width.ts`

**Interfaces:**
- Produces: `REVIEW_PANE_REOPEN_WIDTH = 480`
- Produces: `sessionPanelWidthForReview(available: number): number`

- [x] **Step 1: Record the production benchmark baseline**

Run from `packages/app`:

```powershell
$env:PLAYWRIGHT_WORKERS='1'
$env:PLAYWRIGHT_PORT='3017'
bunx playwright test --config e2e/performance/playwright.config.ts timeline/review-pane-scaling-benchmark.spec.ts --grep "100 changed lines across 1 file$"
```

Expected: one benchmark passes and emits a `BENCHMARK` record.

- [x] **Step 2: Write failing unit tests for reopened width**

Add focused tests:

```ts
describe("sessionPanelWidthForReview", () => {
  test("reserves 480px for reopened review", () => {
    expect(REVIEW_PANE_REOPEN_WIDTH).toBe(480)
    expect(sessionPanelWidthForReview(1400)).toBe(920)
  })

  test("keeps the session minimum on smaller rows", () => {
    expect(sessionPanelWidthForReview(800)).toBe(450)
    expect(sessionPanelWidthForReview(400)).toBe(450)
  })
})
```

- [x] **Step 3: Run the unit test and verify RED**

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: FAIL because the new constant and helper do not exist.

- [x] **Step 4: Implement the pure width calculation**

Add beside the existing width constants:

```ts
export const REVIEW_PANE_REOPEN_WIDTH = 480

export function sessionPanelWidthForReview(available: number) {
  return Math.max(SESSION_PANEL_WIDTH_MIN, available - REVIEW_PANE_REOPEN_WIDTH)
}
```

- [x] **Step 5: Run the unit test and verify GREEN**

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: all width tests pass, including terminal-only coverage.

---

### Task 2: Restore 480px on every review reopen

**Files:**
- Modify: `packages/app/e2e/regression/review-state-persistence.spec.ts`
- Modify: `packages/app/src/pages/session.tsx`

**Interfaces:**
- Consumes: `sessionPanelWidthForReview(available)` from Task 1.
- Consumes: `desktopSessionReviewOpen()`, `sessionPanelAvailable()`, and `layout.session.resize(width)`.
- Produces: one transition observer that restores width only when review opens, or when an initially-open review receives its first row measurement.

- [x] **Step 1: Write a failing upgrade-state regression**

Extend `setup` with an optional persisted layout and add a test that preloads a stale full-width value:

```ts
test("reopens stale zero-width review at 480px", async ({ page }) => {
  await setup(page, { layout: { review: { diffStyle: "split", panelOpened: false }, session: { width: 10_000 } } })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(sessionHref(sessionA))
  await expectSessionTitle(page, titleA)

  const panel = page.locator("#review-panel")
  await page.getByRole("button", { name: "Toggle review" }).click()
  await expect(panel).toBeVisible()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? -1)).toBe(480)

  await page.getByRole("button", { name: "Toggle review" }).click()
  await page.getByRole("button", { name: "Toggle review" }).click()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? -1)).toBe(480)

  await page.reload()
  await expectSessionTitle(page, titleA)
  await expect(panel).toBeVisible()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? -1)).toBe(480)
})
```

In `setup`, write the optional layout to `opencode.global.dat:layout` before navigation.

- [x] **Step 2: Run the regression and verify RED**

```bash
bunx playwright test e2e/regression/review-state-persistence.spec.ts --grep "reopens stale zero-width review"
```

Expected: FAIL at `toBeVisible()` because the stored full-width session value leaves review at zero width.

- [x] **Step 3: Observe the closed-to-open transition once**

Import `sessionPanelWidthForReview` and add an `on`-based effect after `sessionPanelAvailable` is defined. Track the persisted review state instead of the desktop-only derived state, so crossing the mobile breakpoint does not look like a close/reopen:

```ts
let reviewOpenPending = view().reviewPanel.opened()

createEffect(
  on([() => view().reviewPanel.opened(), isDesktop, sessionPanelAvailable], ([opened, desktop, available]) => {
    if (!opened) {
      reviewOpenPending = true
      return
    }
    if (!desktop || !reviewOpenPending || available === undefined) return
    layout.session.resize(sessionPanelWidthForReview(available))
    reviewOpenPending = false
  }),
)
```

This runs on a true closed-to-open transition, and once when an initially-open review receives its first desktop row measurement. It does not rerun during normal window resizing, breakpoint round trips, or review dragging.

- [x] **Step 4: Preserve the gesture-start width during drag-close**

Capture `sessionPanelResizedWidth()` on pointer down and restore it at the drag-close endpoint. This prevents intermediate drag events from changing a terminal-only right pane after review closes, while the next review open still derives its `480px` width from the current row.

If `layout.session.reset()` has no remaining callers, remove that method from `packages/app/src/context/layout.tsx`.

- [x] **Step 5: Run focused unit and E2E tests**

```powershell
bun test src/pages/session/session-panel-width.test.ts
if ($?) { bunx playwright test e2e/regression/review-state-persistence.spec.ts }
```

Expected: all width tests and all review-state regression cases pass.

---

### Task 3: Verify and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-12-review-pane-reopen-width.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1 and 2.
- Produces: a verified implementation commit containing only task-related files.

- [x] **Step 1: Run app type checking**

```bash
bun typecheck
```

Expected: exits successfully with no TypeScript errors.

- [x] **Step 2: Repeat the focused production benchmark**

```powershell
$env:PLAYWRIGHT_WORKERS='1'
$env:PLAYWRIGHT_PORT='3017'
bunx playwright test --config e2e/performance/playwright.config.ts timeline/review-pane-scaling-benchmark.spec.ts --grep "100 changed lines across 1 file$"
```

Expected: benchmark passes; compare metrics with Task 1 without enforcing a machine-dependent threshold.

- [x] **Step 3: Review and commit**

```bash
git diff --check
git status --short
git diff -- packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts packages/app/src/pages/session.tsx packages/app/src/context/layout.tsx packages/app/e2e/regression/review-state-persistence.spec.ts docs/superpowers/plans/2026-08-12-review-pane-reopen-width.md
git add packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts packages/app/src/pages/session.tsx packages/app/src/context/layout.tsx packages/app/e2e/regression/review-state-persistence.spec.ts docs/superpowers/plans/2026-08-12-review-pane-reopen-width.md
git commit -m "fix(app): 修复审查栏重开零宽问题"
```
