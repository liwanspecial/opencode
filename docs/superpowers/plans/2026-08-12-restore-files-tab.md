# Restore Files Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a fixed Files tab in both desktop session side-panel layouts.

**Architecture:** Keep `files` as a built-in session tab in the existing tab-state selector. The new layout reuses `SessionFileBrowserTab`; the old layout renders its existing `FileTree` in a fixed Files tab. Keep `open-file` as the temporary quick-open tab and keep normal file tabs unchanged.

**Tech Stack:** TypeScript, SolidJS, Bun test, Playwright.

## Global Constraints

- Reuse `SessionFileBrowserTab`; do not restore the legacy `FileTree` page.
- Keep the existing `open-file` quick-open behavior.
- Do not change the review diff tree's persisted open state.
- Use the existing `session.tab.files` localization key.
- Preserve the old layout's existing `FileTree` appearance and file-opening behavior.
- Run tests from `packages/app`, never the repository root.

---

### Task 1: Restore The Fixed Files Tab

**Files:**
- Modify: `packages/app/src/pages/session/helpers.ts`
- Modify: `packages/app/src/pages/session/helpers.test.ts`
- Modify: `packages/app/src/pages/session/session-side-panel.tsx`
- Modify: `packages/app/e2e/regression/review-open-file.spec.ts`

**Interfaces:**
- Consumes: `SessionFileBrowserTab`, `SessionFileBrowserState`, `SESSION_OPEN_FILE_TAB`, `session.tab.files`.
- Produces: built-in tab value `files`, `createSessionTabs(...).filesOpen`, and a fixed Files trigger in `SessionSidePanel`.

- [x] **Step 1: Write failing tab-state tests**

Add tests proving that `files` is excluded from normal `panelTabs`, can be the active tab, is not closable, and remains a fallback when persisted in `tabs.all`.

```ts
test("treats Files as a fixed built-in tab", () => {
  createRoot((dispose) => {
    const [state] = createStore({ active: "files" as string | undefined, all: ["files", "file://src/a.ts"] })
    const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
    const result = createSessionTabs({
      tabs,
      pathFromTab: (tab) => (tab.startsWith("file://") ? tab.slice("file://".length) : undefined),
      normalizeTab: (tab) => tab,
      fileBrowser: () => true,
    })

    expect(result.filesOpen()).toBe(true)
    expect(result.panelTabs()).toEqual(["file://src/a.ts"])
    expect(result.activeTab()).toBe("files")
    expect(result.closableTab()).toBeUndefined()
    dispose()
  })
})
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `bun test src/pages/session/helpers.test.ts` from `packages/app`.

Expected: FAIL because `filesOpen` is not returned and `files` is currently treated as a normal tab.

- [x] **Step 3: Implement the built-in tab state**

In `createSessionTabs`, add `filesOpen`, filter `files` from `panelTabs`, accept it in `activeTab`, use it as a fallback before Review, and keep it out of `closableTab`.

```ts
const filesOpen = createMemo(() => input.tabs().active() === "files" || input.tabs().all().includes("files"))
```

- [x] **Step 4: Run the focused unit test**

Run: `bun test src/pages/session/helpers.test.ts` from `packages/app`.

Expected: PASS.

- [x] **Step 5: Write the failing browser regression**

Extend `review-open-file.spec.ts` to assert that the fixed Files tab is visible, selecting it shows the project file tree, selecting a file opens its preview, and selecting Review restores the review panel.

Use accessible locators:

```ts
await panel.getByRole("tab", { name: "Files" }).click()
await expect(panel.getByRole("tab", { name: "Files" })).toHaveAttribute("data-selected", "")
await expect(panel.getByText("open-file-project", { exact: true })).toBeVisible()
await panel.getByText("README.md", { exact: true }).click()
await panel.getByRole("tab", { name: /Files Changed/ }).click()
```

- [x] **Step 6: Run the focused E2E test and verify failure**

Run the existing package Playwright command targeting `e2e/regression/review-open-file.spec.ts` from `packages/app`.

Expected: FAIL because the fixed Files tab is absent.

- [x] **Step 7: Render the fixed Files tab and reuse the browser**

In the new-layout Tabs list, render a fixed trigger after Review:

```tsx
<Tabs.Trigger value="files">{language.t("session.tab.files")}</Tabs.Trigger>
```

Update `browserTab`, `fileBrowserMounted`, and `fileBrowserVisible` so the `files` value renders `SessionFileBrowserTab` with the project tree, while normal file and `open-file` behavior remains intact.

- [x] **Step 8: Run focused verification**

Run from `packages/app`:

```bash
bun test src/pages/session/helpers.test.ts
bun typecheck
```

Run the target Playwright regression using the package's existing E2E command.

Expected: all commands PASS.

- [x] **Step 9: Review the final diff**

Run:

```bash
git diff --check
git diff -- packages/app/src/pages/session/helpers.ts packages/app/src/pages/session/helpers.test.ts packages/app/src/pages/session/session-side-panel.tsx packages/app/e2e/regression/review-open-file.spec.ts
```

Confirm the diff only restores the fixed Files entry and its tests. Do not commit unless explicitly requested.

### Task 2: Restore Files In The Old Layout

**Files:**
- Modify: `packages/app/src/pages/session/session-side-panel.tsx`
- Create: `packages/app/e2e/regression/legacy-files-tab.spec.ts`

**Interfaces:**
- Consumes: built-in `files` tab state from `createSessionTabs`, existing `FileTree`, `diffFiles`, `kinds`, `nofiles`, `empty`, and `openTab`.
- Produces: a fixed Files trigger and old-layout project tree panel.

- [ ] **Step 1: Add a failing old-layout E2E regression**

Configure `settings.v3.general.newLayoutDesigns` as `false`, open the review panel, assert an exact `Files` tab exists, select it, select a project file, and assert its file tab and content become visible.

- [ ] **Step 2: Run the regression and verify it fails**

Run `bun run test:e2e -- e2e/regression/legacy-files-tab.spec.ts` from `packages/app`.

Expected: FAIL because the old-layout fallback branch has no fixed Files trigger.

- [ ] **Step 3: Render the fixed old-layout Files tab**

Add `<Tabs.Trigger value="files">` after Review in the fallback branch. Render a `Tabs.Content value="files">` using the existing root `FileTree`, changed-file metadata, empty state, and `openTab(file.tab(node.path))` click path.

- [ ] **Step 4: Run old- and new-layout regressions**

Run the old-layout regression together with `review-open-file.spec.ts`, `review-state-persistence.spec.ts`, `file-browser-sidebar-tab-switch.spec.ts`, and `review-tab-switch.spec.ts`.

Expected: all tests PASS.

- [ ] **Step 5: Build and verify the release installer**

Run the production desktop build and Windows x64 NSIS package commands with `OPENCODE_CHANNEL=prod` and `OPENCODE_VERSION=1.18.16`. Verify product name, version, non-zero size, SHA-256, and Authenticode status.
