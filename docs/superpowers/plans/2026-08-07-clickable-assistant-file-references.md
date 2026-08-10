# Clickable Assistant File References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit Markdown file links and path-like inline code in assistant responses open the referenced file inside the current OpenCode session, including optional line navigation.

**Architecture:** Preserve each Markdown link's original target as inert sanitized metadata, then let `@opencode-ai/session-ui` classify local references and emit a typed `{ path, line? }` callback. The app session page owns navigation: it normalizes the path with the existing file context, opens the internal file tab, selects an optional line, and opens the file side panel. External URL handling and Electron security policy remain unchanged.

**Tech Stack:** TypeScript, SolidJS, marked, DOMPurify, Bun tests, Happy DOM.

## Global Constraints

- Support workspace-relative, Windows absolute, POSIX absolute, space-containing, and Unicode paths.
- Support optional `:line` and `#Lline` suffixes using 1-based line numbers.
- Only explicit Markdown links and path-like inline code become file references; ordinary prose remains unchanged.
- HTTP, HTTPS, and mail links retain their existing behavior.
- Do not relax DOMPurify URI rules or Electron external-navigation protocol rules.
- Open files inside the current OpenCode session, never in a system application.
- Do not add file-existence checks to Markdown rendering.
- Do not create a git commit unless the user explicitly requests one.

## File Structure

- Create `packages/session-ui/src/components/markdown-file-reference.ts`: pure local-reference parsing and shared callback types.
- Create `packages/session-ui/src/components/markdown-file-reference.test.ts`: parser coverage for supported and rejected references.
- Modify `packages/ui/src/context/marked-parser.tsx`: retain original Markdown link targets in inert `data-markdown-href` metadata.
- Modify `packages/ui/src/context/marked-parser.test.ts`: verify metadata escaping and existing web-link output.
- Modify `packages/session-ui/src/components/markdown.tsx`: decorate local references and delegate clicks to the callback.
- Create `packages/app/src/pages/session/markdown-file-reference.test.tsx`: Happy DOM coverage for link decoration and click delegation.
- Modify `packages/session-ui/src/components/message-part.tsx`: forward file-open callbacks into assistant text and reasoning Markdown.
- Modify `packages/app/src/pages/session/helpers.ts`: provide a testable internal-file navigation action.
- Modify `packages/app/src/pages/session/helpers.test.ts`: verify path normalization, tab activation, panel opening, and line selection.
- Modify `packages/app/src/pages/session/timeline/message-timeline.tsx`: pass the callback to assistant message parts.
- Modify `packages/app/src/pages/session.tsx`: construct the callback from existing file, tab, and panel APIs.

---

### Task 1: Preserve Original Markdown Link Targets

**Files:**
- Modify: `packages/ui/src/context/marked-parser.tsx:5-17`
- Modify: `packages/ui/src/context/marked-parser.test.ts:4-10`

**Interfaces:**
- Produces: sanitized parser output containing `data-markdown-href="<original target>"` on every Markdown anchor.
- Preserves: `href`, `class="external-link"`, `target="_blank"`, and `rel="noopener noreferrer"` for normal links.

- [ ] **Step 1: Write failing parser tests**

Update the web-link expectation and add local/escaped target cases:

```ts
test("renders links with application attributes", async () => {
  expect(await parser.parse("[OpenCode](https://opencode.ai)")).toBe(
    '<p><a href="https://opencode.ai" data-markdown-href="https://opencode.ai" class="external-link" target="_blank" rel="noopener noreferrer">OpenCode</a></p>\n',
  )
})

test("preserves local link targets as inert metadata", async () => {
  const html = await parser.parse("[file](<C:/Users/l/My Project/应用.tsx:12>)")
  expect(html).toContain('data-markdown-href="C:/Users/l/My Project/应用.tsx:12"')
})

test("escapes link attributes", async () => {
  const html = await parser.parse('[file](<src/a&quot; onclick=&quot;alert(1).ts>)')
  expect(html).not.toContain(' onclick="')
  expect(html).toContain("&amp;quot;")
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `packages/ui`:

```powershell
bun test src/context/marked-parser.test.ts
```

Expected: FAIL because `data-markdown-href` is absent and link attributes are interpolated without explicit escaping.

- [ ] **Step 3: Add attribute escaping and metadata**

Add a local helper and use it for `href`, `title`, and `data-markdown-href`:

```ts
function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
```

The renderer output must be:

```ts
link({ href, title, text }) {
  const target = escapeAttribute(href)
  const titleAttr = title ? ` title="${escapeAttribute(title)}"` : ""
  return `<a href="${target}" data-markdown-href="${target}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run from `packages/ui`:

```powershell
bun test src/context/marked-parser.test.ts
```

Expected: PASS.

### Task 2: Parse And Handle Local File References

**Files:**
- Create: `packages/session-ui/src/components/markdown-file-reference.ts`
- Create: `packages/session-ui/src/components/markdown-file-reference.test.ts`
- Modify: `packages/session-ui/src/components/markdown.tsx:35-36,366-458,491-500,620-669,718-737`
- Create: `packages/app/src/pages/session/markdown-file-reference.test.tsx`

**Interfaces:**
- Produces: `MarkdownFileReference = { path: string; line?: number }`.
- Produces: `MarkdownFileOpenHandler = (reference: MarkdownFileReference) => void`.
- Produces: `parseMarkdownFileReference(value, source)` where `source` is `"link" | "inline"`.
- Produces from `markdown.tsx`: `decorateMarkdownFileReferences(root, onFileOpen)` and `setupMarkdownFileClicks(root, getOnFileOpen)` for DOM-level verification.

- [ ] **Step 1: Write failing pure parser tests**

Create table-driven tests with these expectations:

```ts
import { describe, expect, test } from "bun:test"
import { parseMarkdownFileReference } from "./markdown-file-reference"

describe("parseMarkdownFileReference", () => {
  test.each([
    ["src/app.tsx", "link", { path: "src/app.tsx" }],
    ["./src/app.tsx:12", "inline", { path: "./src/app.tsx", line: 12 }],
    ["C:/repo/My Project/应用.tsx:18", "link", { path: "C:/repo/My Project/应用.tsx", line: 18 }],
    ["C:\\repo\\应用.tsx#L9", "inline", { path: "C:\\repo\\应用.tsx", line: 9 }],
    ["/repo/src/app.tsx#L27", "link", { path: "/repo/src/app.tsx", line: 27 }],
    ["file:///C:/repo/src/app.tsx", "link", { path: "C:/repo/src/app.tsx" }],
    ["docs/My File.md", "inline", { path: "docs/My File.md" }],
  ] as const)("parses %s", (value, source, expected) => {
    expect(parseMarkdownFileReference(value, source)).toEqual(expected)
  })

  test.each([
    "https://opencode.ai/docs",
    "http://localhost:4444",
    "mailto:test@example.com",
    "javascript:alert(1)",
    "plain words",
    "app.tsx:not-a-line",
  ])("rejects %s", (value) => {
    expect(parseMarkdownFileReference(value, "link")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run parser tests and verify RED**

Run from `packages/session-ui`:

```powershell
bun test src/components/markdown-file-reference.test.ts
```

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement the pure parser**

Implement the exported types and function with this decision order:

```ts
export type MarkdownFileReference = { path: string; line?: number }
export type MarkdownFileOpenHandler = (reference: MarkdownFileReference) => void

export function parseMarkdownFileReference(value: string, source: "link" | "inline") {
  const raw = value.trim()
  if (!raw) return
  if (/^(https?|mailto):/i.test(raw)) return
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw) && !/^file:\/\//i.test(raw)) return

  const hash = raw.match(/#L(\d+)$/i)
  const colon = hash ? undefined : raw.match(/:(\d+)$/)
  const lineText = hash?.[1] ?? colon?.[1]
  const withoutLine = lineText ? raw.slice(0, -(hash?.[0].length ?? colon![0].length)) : raw
  const fileURL = /^file:\/\//i.test(withoutLine)
  const encoded = fileURL ? withoutLine.slice("file://".length) : withoutLine
  const decoded = decode(encoded)
  const path = fileURL && /^\/[a-z]:[\\/]/i.test(decoded) ? decoded.slice(1) : decoded
  if (!looksLikePath(path, source, fileURL)) return

  const line = lineText ? Number(lineText) : undefined
  if (line !== undefined && (!Number.isSafeInteger(line) || line < 1)) return
  return line === undefined ? { path } : { path, line }
}
```

Keep `decode` exception-safe. `looksLikePath` must accept file URLs, drive/UNC/POSIX paths, `./` and `../` paths, existing `inlineCodeKind(path) === "path"`, and inline paths containing whitespace only when they also contain `/` or `\\`. It must reject ordinary whitespace prose and package-like `@scope/name` values.

- [ ] **Step 4: Run parser tests and verify GREEN**

Run from `packages/session-ui`:

```powershell
bun test src/components/markdown-file-reference.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing DOM interaction tests**

In the app package, use its Happy DOM preload and the public helpers exported by `@opencode-ai/session-ui/markdown`:

```tsx
import { describe, expect, test } from "bun:test"
import {
  decorateMarkdownFileReferences,
  setupMarkdownFileClicks,
  type MarkdownFileReference,
} from "@opencode-ai/session-ui/markdown"

describe("assistant Markdown file references", () => {
  test("opens explicit links and path-like inline code", () => {
    const root = document.createElement("div")
    root.innerHTML = [
      '<a href="#" data-markdown-href="C:/repo/My Project/应用.tsx:12" class="external-link">file</a>',
      "<code>src/app.tsx#L7</code>",
      '<a href="https://opencode.ai" data-markdown-href="https://opencode.ai" class="external-link">web</a>',
    ].join("")
    const opened: MarkdownFileReference[] = []
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference))
    const cleanup = setupMarkdownFileClicks(root, () => (reference) => opened.push(reference))

    root.querySelector<HTMLElement>('[data-file-path="C:/repo/My Project/应用.tsx"]')!.click()
    root.querySelector<HTMLElement>('[data-file-path="src/app.tsx"]')!.click()

    expect(opened).toEqual([
      { path: "C:/repo/My Project/应用.tsx", line: 12 },
      { path: "src/app.tsx", line: 7 },
    ])
    expect(root.querySelector('a[href="https://opencode.ai"]')?.classList.contains("external-link")).toBe(true)
    cleanup()
  })
})
```

- [ ] **Step 6: Run DOM tests and verify RED**

Run from `packages/app`:

```powershell
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/markdown-file-reference.test.tsx
```

Expected: FAIL because the Markdown DOM helper exports do not exist.

- [ ] **Step 7: Decorate local references and delegate clicks**

In `markdown.tsx`:

1. Import and re-export `MarkdownFileReference` and `MarkdownFileOpenHandler`.
2. Add optional `onFileOpen?: MarkdownFileOpenHandler` to `Markdown` props and include it in `splitProps` so it is not spread onto the root `<div>`.
3. Export `decorateMarkdownFileReferences(root, onFileOpen)`. For anchors with `data-markdown-href`, parse as `"link"`; for unwrapped inline code, parse as `"inline"`. Mark accepted elements with `data-file-path` and optional `data-file-line`, use `href="#"`, replace `external-link` with `file-link`, and remove `target`/`rel`.
4. Export `setupMarkdownFileClicks(root, getOnFileOpen)`. Use one delegated `click` listener, find the closest `[data-file-path]`, call `preventDefault()` and `stopPropagation()`, then invoke the current callback with the dataset path and numeric line.
5. Call file decoration from `decorate(...)` after `markInlineCode(...)` and before URL code-link decoration. Ensure `markCodeLinks` never unwraps an anchor carrying `data-file-path`.
6. Install one file-click listener alongside `setupCodeCopy`, and dispose it in `onCleanup`.

The accepted-element metadata must follow this shape:

```ts
target.dataset.filePath = reference.path
if (reference.line !== undefined) target.dataset.fileLine = String(reference.line)
```

- [ ] **Step 8: Run DOM and parser tests and verify GREEN**

Run:

```powershell
# packages/app
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/markdown-file-reference.test.tsx

# packages/session-ui
bun test src/components/markdown-file-reference.test.ts src/components/markdown-inline-code-kind.test.ts
```

Expected: PASS.

### Task 3: Open References In The Session File Panel

**Files:**
- Modify: `packages/app/src/pages/session/helpers.ts:119-160`
- Modify: `packages/app/src/pages/session/helpers.test.ts:1-90`
- Modify: `packages/session-ui/src/components/message-part.tsx:166-206,336-346,724-825,965-1040,1433-1452,1654-1773`
- Modify: `packages/app/src/pages/session/timeline/message-timeline.tsx:22-29,238-258,1021-1082`
- Modify: `packages/app/src/pages/session.tsx:77,513-532,1156-1162,2082-2114`

**Interfaces:**
- Consumes: `MarkdownFileReference` and `MarkdownFileOpenHandler` from Task 2.
- Produces: `createOpenAssistantFile(input): MarkdownFileOpenHandler`.
- Produces: optional `onFileOpen` props through `MessagePartProps`, `PacedMarkdown`, and `MessageTimeline`.

- [ ] **Step 1: Write failing navigation helper tests**

Add tests that exercise only public callback behavior:

```ts
describe("createOpenAssistantFile", () => {
  test("normalizes, loads, opens, activates, and selects a line", () => {
    const calls: string[] = []
    const selected: Array<[string, { start: number; end: number } | null]> = []
    const open = createOpenAssistantFile({
      normalizePath: (path) => path.replace("C:/repo/", ""),
      tabForPath: (path) => `file://${path}`,
      loadFile: (path) => calls.push(`load:${path}`),
      openTab: (tab) => calls.push(`open:${tab}`),
      setActive: (tab) => calls.push(`active:${tab}`),
      setSelectedLines: (path, range) => selected.push([path, range]),
      openFilePanel: () => calls.push("panel"),
    })

    open({ path: "C:/repo/src/app.tsx", line: 12 })

    expect(calls).toEqual(["open:file://src/app.tsx", "load:src/app.tsx", "panel", "active:file://src/app.tsx"])
    expect(selected).toEqual([["src/app.tsx", { start: 12, end: 12 }]])
  })

  test("clears a previous line selection when no line is supplied", () => {
    const selected: Array<{ start: number; end: number } | null> = []
    const open = createOpenAssistantFile({
      normalizePath: (path) => path,
      tabForPath: (path) => `file://${path}`,
      loadFile: () => {},
      openTab: () => {},
      setActive: () => {},
      setSelectedLines: (_path, range) => selected.push(range),
      openFilePanel: () => {},
    })

    open({ path: "src/app.tsx" })
    expect(selected).toEqual([null])
  })
})
```

- [ ] **Step 2: Run helper tests and verify RED**

Run from `packages/app`:

```powershell
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/helpers.test.ts
```

Expected: FAIL because `createOpenAssistantFile` does not exist.

- [ ] **Step 3: Implement the navigation helper**

Add this focused helper beside the existing file-tab helpers:

```ts
export const createOpenAssistantFile = (input: {
  normalizePath: (path: string) => string
  tabForPath: (path: string) => string
  loadFile: (path: string) => unknown
  openTab: (tab: string) => unknown
  setActive: (tab: string) => void
  setSelectedLines: (path: string, range: { start: number; end: number } | null) => unknown
  openFilePanel: () => void
}) => {
  return (reference: MarkdownFileReference) => {
    const path = input.normalizePath(reference.path)
    const tab = input.tabForPath(path)
    input.setSelectedLines(path, reference.line === undefined ? null : { start: reference.line, end: reference.line })
    input.openTab(tab)
    input.loadFile(path)
    input.openFilePanel()
    input.setActive(tab)
  }
}
```

Import `MarkdownFileReference` as a type from `@opencode-ai/session-ui/markdown`.

- [ ] **Step 4: Run helper tests and verify GREEN**

Run from `packages/app`:

```powershell
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Forward the callback through assistant rendering**

Apply these exact interface changes:

```ts
// message-part.tsx
export interface MessagePartProps {
  // existing fields
  onFileOpen?: MarkdownFileOpenHandler
}

function PacedMarkdown(props: {
  text: string
  cacheKey: string
  streaming: boolean
  onFileOpen?: MarkdownFileOpenHandler
})
```

Pass `onFileOpen` from `Part` into the dynamic part component, then from `TextPartDisplay` and `ReasoningPartDisplay` into `PacedMarkdown`, and finally into `<Markdown>`. Add the same optional prop to `AssistantParts` and `AssistantMessageDisplay` and forward it to `Part` so non-timeline consumers can opt in without changing default share-page behavior.

```ts
// message-timeline.tsx
export function MessageTimeline(props: {
  // existing fields
  onFileOpen: MarkdownFileOpenHandler
})
```

Pass `props.onFileOpen` to each assistant `<MessagePart>`.

- [ ] **Step 6: Construct the callback in the session page**

Import `createOpenAssistantFile` from `./session/helpers` and create it after `openReviewPanel` is defined:

```ts
const openAssistantFile = createOpenAssistantFile({
  normalizePath: file.normalize,
  tabForPath: file.tab,
  loadFile: file.load,
  openTab: tabs().open,
  setActive: tabs().setActive,
  setSelectedLines: file.setSelectedLines,
  openFilePanel: openReviewPanel,
})
```

Pass `onFileOpen={openAssistantFile}` to `<MessageTimeline>`.

- [ ] **Step 7: Run focused tests and type checks**

Run:

```powershell
# packages/app
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/helpers.test.ts ./src/pages/session/markdown-file-reference.test.tsx
bun typecheck

# packages/session-ui
bun typecheck
```

Expected: all commands exit successfully.

### Task 4: Regression Verification

**Files:**
- No source edits expected.

**Interfaces:**
- Verifies all interfaces and behavior introduced by Tasks 1-3.

- [ ] **Step 1: Run package test suites**

Run:

```powershell
# packages/ui
bun test src

# packages/session-ui
bun test src

# packages/app
bun run test:unit
```

Expected: all suites pass with no new failures.

- [ ] **Step 2: Run package type checks**

Run:

```powershell
# packages/ui
bun typecheck

# packages/session-ui
bun typecheck

# packages/app
bun typecheck
```

Expected: all commands exit successfully.

- [ ] **Step 3: Inspect the final diff**

Run from the repository root:

```powershell
git status --short
git diff --check
git diff -- packages/ui/src/context/marked-parser.tsx packages/session-ui/src/components/markdown-file-reference.ts packages/session-ui/src/components/markdown.tsx packages/session-ui/src/components/message-part.tsx packages/app/src/pages/session/helpers.ts packages/app/src/pages/session/timeline/message-timeline.tsx packages/app/src/pages/session.tsx
```

Expected: only the planned files plus their tests and design/plan documents are changed; `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Record manual verification limitation**

Do not restart an existing app or server process. If no already-running local app is available, report that automated parser, DOM, navigation, regression, and type-check coverage passed, while live click-through remains unverified in this session.
