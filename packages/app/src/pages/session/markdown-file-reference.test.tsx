import { afterAll, describe, expect, mock, test } from "bun:test"
import type { MarkdownFileReference } from "@opencode-ai/session-ui/markdown"

mock.module("../../../../session-ui/src/components/markdown.worker.ts?worker&url", () => ({ default: "" }))

const { decorateMarkdownFileReferences, setupMarkdownFileClicks } = await import("@opencode-ai/session-ui/markdown")

afterAll(() => mock.restore())

describe("assistant Markdown file references", () => {
  test("opens explicit links and path-like inline code", () => {
    const root = document.createElement("div")
    root.innerHTML = [
      '<a href="#" data-markdown-href="C:/repo/My Project/应用.tsx:12" class="external-link" target="_blank" rel="noopener noreferrer">file</a>',
      "<code>src/app.tsx#L7</code>",
      '<a href="https://opencode.ai" data-markdown-href="https://opencode.ai" class="external-link">web</a>',
    ].join("")
    const opened: MarkdownFileReference[] = []
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference))
    const cleanup = setupMarkdownFileClicks(root, () => (reference) => opened.push(reference))

    const link = root.querySelector<HTMLElement>('[data-file-path="C:/repo/My Project/应用.tsx"]')!
    const inline = root.querySelector<HTMLElement>('[data-file-path="src/app.tsx"]')!
    link.click()
    inline.click()

    expect(opened).toEqual([
      { path: "C:/repo/My Project/应用.tsx", line: 12 },
      { path: "src/app.tsx", line: 7 },
    ])
    expect(link.classList.contains("file-link")).toBe(true)
    expect(link.classList.contains("external-link")).toBe(false)
    expect(link.getAttribute("href")).toBe("#")
    expect(link.hasAttribute("target")).toBe(false)
    expect(link.hasAttribute("rel")).toBe(false)
    expect(inline.dataset.fileLine).toBe("7")
    expect(root.querySelector('a[href="https://opencode.ai"]')?.classList.contains("external-link")).toBe(true)
    cleanup()
  })

  test("uses the current handler for references added by streaming updates and cleans up", () => {
    const root = document.createElement("div")
    const first: MarkdownFileReference[] = []
    const second: MarkdownFileReference[] = []
    let handler = (reference: MarkdownFileReference) => first.push(reference)
    const cleanup = setupMarkdownFileClicks(root, () => handler)

    root.innerHTML = "<code>src/first.ts</code>"
    decorateMarkdownFileReferences(root, handler)
    root.querySelector<HTMLElement>('[data-file-path="src/first.ts"]')!.click()

    handler = (reference) => second.push(reference)
    root.innerHTML = "<code>src/second.ts:24</code>"
    decorateMarkdownFileReferences(root, handler)
    const streamed = root.querySelector<HTMLElement>('[data-file-path="src/second.ts"]')!
    streamed.click()
    cleanup()
    streamed.click()

    expect(first).toEqual([{ path: "src/first.ts" }])
    expect(second).toEqual([{ path: "src/second.ts", line: 24 }])
  })

  test("leaves references inert without a handler and preserves non-file anchors", () => {
    const root = document.createElement("div")
    root.innerHTML = [
      '<a href="#" data-markdown-href="src/app.tsx" class="external-link">file</a>',
      '<a href="https://opencode.ai" data-markdown-href="https://opencode.ai" class="external-link"><code>https://opencode.ai</code></a>',
      '<a href="javascript:alert(1)" data-markdown-href="javascript:alert(1)" class="external-link">unsafe</a>',
      "<code>@scope/name</code>",
    ].join("")

    decorateMarkdownFileReferences(root, undefined)

    expect(root.querySelector("[data-file-path]")).toBeNull()
    expect(root.querySelectorAll("a.external-link")).toHaveLength(3)
    expect(root.querySelector('a[href="https://opencode.ai"] > code')).not.toBeNull()
  })
})
