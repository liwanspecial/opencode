# Review Pane Drag-to-Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag the right review pane to `0%`, close it immediately at the endpoint, and restore the existing `600px` session-width default when review is reopened.

**Architecture:** Remove review-specific minimum reservations from the session width helper while preserving the terminal-only `360px` reservation. Keep closure logic in the session page: when the resize callback reaches the full available row width, reset persisted session width through the layout controller, close review state, and do not persist the endpoint width.

**Tech Stack:** TypeScript, SolidJS, Bun test runner, Playwright

## Global Constraints

- Unified and split review modes allow `0%` remaining review width.
- Reaching `0%` closes review immediately.
- Drag-close resets session width to the existing `600px` default.
- Reopening review produces a visible non-zero pane.
- Terminal-only mode continues reserving `360px`.
- Do not change file-tree sizing, review-sidebar sizing, responsive breakpoints, or generic `ResizeHandle` behavior.
- Run tests and type checking from `packages/app`, never from the repository root.
- Record the focused production review benchmark before and after changing session code.

---

### Task 1: Allow review width to reach zero

**Files:**
- Modify: `packages/app/src/pages/session/session-panel-width.test.ts:1-61`
- Modify: `packages/app/src/pages/session/session-panel-width.ts:1-32`
- Modify: `packages/app/src/pages/session.tsx:455-503`

**Interfaces:**
- Consumes: `sessionPanelWidthMax(input: { available: number; review: boolean }): number`
- Produces: Review mode returns the full available width; terminal-only mode returns `available - 360`, bounded by the existing `450px` session minimum.

- [x] **Step 1: Record the production benchmark baseline**

Run from `packages/app`:

```powershell
$env:PLAYWRIGHT_WORKERS='1'
$env:PLAYWRIGHT_PORT='3017'
bunx playwright test --config e2e/performance/playwright.config.ts timeline/review-pane-scaling-benchmark.spec.ts --grep "100 changed lines across 1 file$"
```

Expected: one benchmark passes and emits a `BENCHMARK` record for later comparison.

- [x] **Step 2: Write failing width-limit tests**

Replace review minimum assertions with explicit full-width expectations and keep terminal coverage:

```ts
test("allows the unified review pane to reach zero width", () => {
  expect(sessionPanelWidthMax({ available: 1700, review: true })).toBe(1700)
})

test("preserves the terminal-only pane minimum", () => {
  expect(sessionPanelWidthMax({ available: 1700, review: false })).toBe(1340)
})
```

Assert a stored width of `1600` remains `1600` when review is open with `1700px` available in both unified and split modes.

- [x] **Step 3: Run the focused test and verify RED**

Run from `packages/app`:

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: review-mode assertions fail because the helper still reserves `280px` or `640px`.

- [x] **Step 4: Implement zero-width review limits**

Remove `REVIEW_PANE_WIDTH_MIN`, `REVIEW_PANE_WIDTH_MIN_SPLIT`, and the obsolete `split` input. Both review styles now share the same full-width review limit:

```ts
export const SESSION_PANEL_WIDTH_MIN = 450
const TERMINAL_PANE_WIDTH_MIN = 360

export function sessionPanelWidthMax(input: { available: number; review: boolean }) {
  const max = input.review ? input.available : input.available - TERMINAL_PANE_WIDTH_MIN
  return Math.max(SESSION_PANEL_WIDTH_MIN, max)
}
```

Remove the now-unused `splitReview` call path from `session.tsx`.

- [x] **Step 5: Run the focused test and verify GREEN**

Run from `packages/app`:

```bash
bun test src/pages/session/session-panel-width.test.ts
```

Expected: all width tests pass, including terminal-only and small-window behavior.

---

### Task 2: Close review at the drag endpoint

**Files:**
- Modify: `packages/app/e2e/regression/review-state-persistence.spec.ts:14-45`
- Modify: `packages/app/src/context/layout.tsx:744-753`
- Modify: `packages/app/src/pages/session.tsx:2304-2319`

**Interfaces:**
- Consumes: `layout.session.width()`, `layout.session.resize(width)`, `view().reviewPanel.close()`
- Produces: `layout.session.reset(): void`, restoring `DEFAULT_SESSION_WIDTH`; no new test-only production selector is required.

- [x] **Step 1: Write the failing Playwright regression test**

Add a test using the existing `setup(page)` fixture:

```ts
test("closes review when dragged to zero width and reopens at the default width", async ({ page }) => {
  await setup(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(sessionHref(sessionA))
  await expectSessionTitle(page, titleA)
  await page.getByRole("button", { name: "Toggle review" }).click()

  const panel = page.locator("#review-panel")
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  if (!box) throw new Error("Review panel is not visible")
  const initialDividerX = Math.round(box.x)

  await page.mouse.move(box.x - 4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 156, box.y + box.height / 2)
  await page.mouse.up()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.x ?? -1)).toBeGreaterThan(initialDividerX + 100)

  const resized = await panel.boundingBox()
  if (!resized) throw new Error("Resized review panel is not visible")
  await page.mouse.move(resized.x - 4, resized.y + resized.height / 2)
  await page.mouse.down()
  const viewport = page.viewportSize()
  if (!viewport) throw new Error("Viewport size is unavailable")
  await page.mouse.move(viewport.width - 1, resized.y + resized.height / 2)
  await page.mouse.move(viewport.width - 2, resized.y + resized.height / 2)
  await page.mouse.up()

  await expect(panel).toHaveCount(0)
  await page.getByRole("button", { name: "Toggle review" }).click()
  await expect(panel).toBeVisible()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.x ?? -1)).toBe(initialDividerX)
  await page.reload()
  await expectSessionTitle(page, titleA)
  await expect(panel).toBeVisible()
  await expect.poll(async () => Math.round((await panel.boundingBox())?.x ?? -1)).toBe(initialDividerX)
})
```

- [x] **Step 2: Run the regression test and verify RED**

Run from `packages/app`:

```bash
bunx playwright test e2e/regression/review-state-persistence.spec.ts --grep "closes review when dragged"
```

Expected: FAIL because the handle cannot reach the row endpoint and review remains open.

- [x] **Step 3: Add canonical session-width reset**

Extend the layout session controller:

```ts
session: {
  width: createMemo(() => store.session?.width ?? DEFAULT_SESSION_WIDTH),
  resize(width: number) {
    if (!store.session) {
      setStore("session", { width })
      return
    }
    setStore("session", "width", width)
  },
  reset() {
    if (!store.session) {
      setStore("session", { width: DEFAULT_SESSION_WIDTH })
      return
    }
    setStore("session", "width", DEFAULT_SESSION_WIDTH)
  },
},
```

- [x] **Step 4: Close at the endpoint without persisting zero width**

Use a per-gesture latch so document-level mouse moves after closure cannot overwrite the reset width:

```tsx
let reviewDragClosed = false

<div
  onPointerDown={() => {
    reviewDragClosed = false
    size.start()
  }}
>
  <ResizeHandle
    direction="horizontal"
    size={sessionPanelResizedWidth()}
    min={SESSION_PANEL_WIDTH_MIN}
    max={sessionPanelMax()}
    onResize={(width) => {
      if (reviewDragClosed) return
      size.touch()
      if (desktopSessionReviewOpen() && width >= sessionPanelMax()) {
        reviewDragClosed = true
        layout.session.reset()
        view().reviewPanel.close()
        return
      }
      layout.session.resize(width)
    }}
  />
</div>
```

- [x] **Step 5: Run focused unit and regression tests**

Run from `packages/app`:

```powershell
bun test src/pages/session/session-panel-width.test.ts
if ($?) { bunx playwright test e2e/regression/review-state-persistence.spec.ts --grep "closes review when dragged" }
```

Expected: both commands pass; reopening places the session divider at `600px`.

---

### Task 3: Verify and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-07-review-pane-drag-close.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1 and 2.
- Produces: verified implementation commit with only task-related files.

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

Expected: benchmark passes; compare its emitted metrics with Task 1 without enforcing a machine-dependent threshold.

- [x] **Step 3: Review and commit**

```bash
git diff --check
git status --short
git diff -- packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts packages/app/src/context/layout.tsx packages/app/src/pages/session.tsx packages/app/e2e/regression/review-state-persistence.spec.ts docs/superpowers/plans/2026-08-07-review-pane-drag-close.md
git add packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts packages/app/src/context/layout.tsx packages/app/src/pages/session.tsx packages/app/e2e/regression/review-state-persistence.spec.ts docs/superpowers/plans/2026-08-07-review-pane-drag-close.md
git commit -m "feat(app): 支持拖拽关闭右侧审查栏"
```
