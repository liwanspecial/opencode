import { afterAll, describe, expect, mock, test } from "bun:test"
import type { MarkdownFileReference } from "@opencode-ai/session-ui/markdown"

mock.module("../../../../session-ui/src/components/markdown.worker.ts?worker&url", () => ({ default: "" }))

const { decorateMarkdownFileReferences, setupMarkdownFileClicks } = await import("@opencode-ai/session-ui/markdown")
const { sanitizeMarkdown } = await import("@opencode-ai/session-ui/markdown-cache")

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

  test("ignores forged file metadata preserved by sanitization", () => {
    const root = document.createElement("div")
    root.innerHTML = sanitizeMarkdown(
      [
        '<a href="https://opencode.ai/one" data-markdown-href="https://opencode.ai/one" data-file-path="C:/secret.ts" data-file-line="not-a-line" class="external-link">one</a>',
        '<a href="https://opencode.ai/two" data-markdown-href="https://opencode.ai/two" data-file-path="/etc/passwd" data-file-line="-4" class="external-link">two</a>',
      ].join(""),
    )
    const opened: MarkdownFileReference[] = []
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference))
    const cleanup = setupMarkdownFileClicks(root, () => (reference) => opened.push(reference))
    const forged = Array.from(root.querySelectorAll<HTMLAnchorElement>("a"))

    expect(forged.map((anchor) => anchor.dataset.fileLine)).toEqual(["not-a-line", "-4"])
    forged.forEach((anchor) => anchor.click())

    expect(opened).toEqual([])
    expect(forged.every((anchor) => anchor.classList.contains("external-link"))).toBe(true)
    expect(forged.map((anchor) => anchor.href)).toEqual(["https://opencode.ai/one", "https://opencode.ai/two"])
    cleanup()
  })

  test("revokes runtime trust when a file element becomes external", () => {
    const root = document.createElement("div")
    root.innerHTML = '<a href="#" data-markdown-href="src/app.ts" class="external-link">file</a>'
    const opened: MarkdownFileReference[] = []
    const handler = (reference: MarkdownFileReference) => opened.push(reference)
    decorateMarkdownFileReferences(root, handler)
    const cleanup = setupMarkdownFileClicks(root, () => handler)
    const link = root.querySelector<HTMLAnchorElement>("a")!

    link.href = "https://opencode.ai"
    link.dataset.markdownHref = "https://opencode.ai"
    link.dataset.filePath = "C:/forged.ts"
    link.dataset.fileLine = "invalid"
    link.className = "external-link"
    decorateMarkdownFileReferences(root, handler)
    link.click()

    expect(opened).toEqual([])
    cleanup()
  })
})
