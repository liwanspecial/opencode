# Sidebar Session Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, independently controlled session-list collapsing for projects and their local/sandbox workspaces, with automatic expansion when opening a hidden session.

**Architecture:** Extend the existing persisted layout store with a project-level collapsed map keyed by normalized paths. Expose project controls through `ProjectSidebarContext`, retain `workspaceExpanded` as the single workspace-level state source, and reuse the existing workspace header/collapsible primitives for local workspaces.

**Tech Stack:** TypeScript, SolidJS, Solid Store, Kobalte-based `Collapsible`, Bun test, app typecheck

---

## File Structure

- `packages/app/src/pages/layout/helpers.ts`: Pure project-collapse lookup keyed with `pathKey`.
- `packages/app/src/pages/layout/helpers.test.ts`: Default and normalized-key behavior tests.
- `packages/app/src/pages/layout.tsx`: Persisted project state, context methods, and route-driven auto-expansion.
- `packages/app/src/pages/layout/sidebar-project.tsx`: Project chevron and conditional session/workspace rendering.
- `packages/app/src/pages/layout/sidebar-workspace.tsx`: Local workspace header and collapsible session body.
- `packages/app/src/i18n/en.ts`: English project collapse/expand labels used as locale fallback.
- `packages/app/src/i18n/zh.ts`: Simplified Chinese project collapse/expand labels.

### Task 1: Project Collapse State

**Files:**
- Modify: `packages/app/src/pages/layout/helpers.ts`
- Modify: `packages/app/src/pages/layout/helpers.test.ts`
- Modify: `packages/app/src/pages/layout.tsx`

- [x] **Step 1: Write failing normalized-state tests**

Add the import and cases:

```ts
import { projectSessionsExpanded } from "./helpers"

test("defaults project sessions to expanded", () => {
  expect(projectSessionsExpanded({}, "/tmp/demo")).toBe(true)
})

test("reads project collapse state through normalized paths", () => {
  expect(projectSessionsExpanded({ "C:/tmp/demo": true }, "C:\\tmp\\demo\\")).toBe(false)
})
```

- [x] **Step 2: Verify the tests fail**

Run from `packages/app`:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/layout/helpers.test.ts
```

Expected: FAIL because `projectSessionsExpanded` is not exported.

- [x] **Step 3: Implement the lookup helper**

Add to `helpers.ts`:

```ts
export const projectSessionsExpanded = (collapsed: Record<string, boolean>, directory: string) =>
  collapsed[pathKey(directory)] !== true
```

- [x] **Step 4: Add persistent state and route expansion**

Add this field to the persisted store in `layout.tsx`:

```ts
projectSessionsCollapsed: {} as Record<string, boolean>,
```

In `syncSessionRoute`, normalize `root` and expand both levels before scheduling scroll:

```ts
const projectKey = pathKey(root)
if (untrack(() => store.projectSessionsCollapsed[projectKey]) === true) {
  setStore("projectSessionsCollapsed", projectKey, false)
}
const workspaceKey = pathKey(directory)
if (untrack(() => store.workspaceExpanded[workspaceKey]) === false) {
  setStore("workspaceExpanded", workspaceKey, true)
}
```

Expose context methods:

```ts
projectSessionsExpanded: (directory) => projectSessionsExpanded(store.projectSessionsCollapsed, directory),
setProjectSessionsExpanded: (directory, value) =>
  setStore("projectSessionsCollapsed", pathKey(directory), !value),
```

- [x] **Step 5: Verify helper tests pass**

Run the Task 1 test command again.

Expected: PASS.

### Task 2: Project Toggle UI

**Files:**
- Modify: `packages/app/src/pages/layout/sidebar-project.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`

- [x] **Step 1: Extend the project context and tile props**

Add to `ProjectSidebarContext`:

```ts
projectSessionsExpanded: (directory: string) => boolean
setProjectSessionsExpanded: (directory: string, value: boolean) => void
```

Pass an `expanded` accessor and `setExpanded` callback into `ProjectTile`.

- [x] **Step 2: Add localized labels**

Add to English:

```ts
"sidebar.project.sessions.collapse": "Collapse sessions",
"sidebar.project.sessions.expand": "Expand sessions",
```

Add to Simplified Chinese:

```ts
"sidebar.project.sessions.collapse": "折叠会话",
"sidebar.project.sessions.expand": "展开会话",
```

- [x] **Step 3: Render the independent chevron button**

Inside the non-overlay project action area, add an always reachable icon button:

```tsx
<Tooltip
  value={props.language.t(
    props.expanded() ? "sidebar.project.sessions.collapse" : "sidebar.project.sessions.expand",
  )}
  placement="top"
>
  <IconButtonV2
    icon={<IconV2 name={props.expanded() ? "chevron-down" : "chevron-right"} size="small" />}
    variant="ghost"
    size="small"
    class="size-6 rounded-md"
    data-action="project-sessions-toggle"
    aria-expanded={props.expanded()}
    aria-label={props.language.t(
      props.expanded() ? "sidebar.project.sessions.collapse" : "sidebar.project.sessions.expand",
    )}
    onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      props.setExpanded(!props.expanded())
    }}
  />
</Tooltip>
```

- [x] **Step 4: Hide project content when collapsed**

Create:

```ts
const expanded = createMemo(() => props.ctx.projectSessionsExpanded(props.project.worktree))
```

Wrap the existing non-overlay preview/full-list block in `<Show when={expanded()}>`. Keep `ProjectTile` outside this guard so navigation, status, and project actions remain visible.

- [x] **Step 5: Run app typecheck**

Run from `packages/app`:

```bash
bun typecheck
```

Expected: PASS with no TypeScript diagnostics.

### Task 3: Local Workspace Collapse and Verification

**Files:**
- Modify: `packages/app/src/pages/layout/sidebar-workspace.tsx`

- [x] **Step 1: Add local workspace open state**

In `LocalWorkspace`, derive:

```ts
const open = createMemo(() => props.ctx.workspaceExpanded(props.project.worktree, true))
const branch = createMemo(() => workspace().store.vcs?.branch)
```

- [x] **Step 2: Reuse the workspace header inside a collapsible**

For embedded rendering, wrap the list with:

```tsx
<Collapsible
  variant="ghost"
  open={open()}
  class="shrink-0"
  onOpenChange={(value) => props.ctx.setWorkspaceExpanded(props.project.worktree, value)}
>
  <div class="py-1 group/workspace">
    <Collapsible.Trigger
      class="flex items-center justify-between w-full pl-2 pr-2 py-1.5 rounded-md hover:bg-surface-raised-base-hover"
      data-action="workspace-toggle"
      data-workspace={base64Encode(props.project.worktree)}
    >
      <WorkspaceHeader
        local={() => true}
        busy={() => false}
        open={open}
        directory={props.project.worktree}
        language={language}
        branch={branch}
        workspaceValue={() => branch() ?? getFilename(props.project.worktree)}
        workspaceEditActive={() => false}
        InlineEditor={props.ctx.InlineEditor}
        renameWorkspace={props.ctx.renameWorkspace}
        setEditor={props.ctx.setEditor}
        projectId={props.project.id}
      />
    </Collapsible.Trigger>
  </div>
  <Collapsible.Content>{sessionList}</Collapsible.Content>
</Collapsible>
```

Keep non-embedded `LocalWorkspace` rendering unchanged so the standalone/mobile scroll container does not gain a redundant inner heading.

- [x] **Step 3: Run focused tests and typecheck**

Run from `packages/app`:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/layout/helpers.test.ts ./src/pages/layout/sidebar-items.test.ts
bun typecheck
```

Expected: all tests PASS and typecheck exits 0.

- [x] **Step 4: Verify formatting and diff scope**

Run from repository root:

```bash
bunx prettier --check packages/app/src/pages/layout.tsx packages/app/src/pages/layout/helpers.ts packages/app/src/pages/layout/helpers.test.ts packages/app/src/pages/layout/sidebar-project.tsx packages/app/src/pages/layout/sidebar-workspace.tsx packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts
```

Expected: formatting and diff checks pass; only the plan and intended app files are modified.

- [x] **Step 5: Run manual UI regression**

Start the backend from `packages/opencode` with `bun run --conditions=browser ./src/index.ts serve --port 4096` and app from `packages/app` with `bun dev -- --port 4444`. Open `http://localhost:4444` and verify project toggle independence, workspace toggle independence, persistence after refresh, and automatic expansion when navigating to a hidden session. Do not restart any already-running app or server process.
