import { afterAll, describe, expect, mock, test } from "bun:test"
import type { MarkdownFileReference } from "@opencode-ai/session-ui/markdown"
import { createMarkdownParser, parseMarkdownWithProvenance } from "@opencode-ai/ui/context/marked-parser"

mock.module("../../../../session-ui/src/components/markdown.worker.ts?worker&url", () => ({ default: "" }))

const { decorateMarkdown, decorateMarkdownFileReferences, setupMarkdownContextMenu, setupMarkdownFileClicks } =
  await import("@opencode-ai/session-ui/markdown")
const { sanitizeMarkdown } = await import("@opencode-ai/session-ui/markdown-cache")

afterAll(() => mock.restore())

describe("assistant Markdown file references", () => {
  test("trusts only genuine Marked links after sanitization", async () => {
    const parser = createMarkdownParser((code, language) => `<pre data-language="${language}">${code}</pre>`)
    const forgedCapability = "attacker-supplied-capability"
    const parsed = await parseMarkdownWithProvenance(
      parser,
      [
        "[genuine](<C:/repo/app.ts:12>)",
        `<a href="https://example.com/forged" data-markdown-href="C:/secret.ts:9" data-markdown-capability="${forgedCapability}" class="external-link">forged</a>`,
        "[protocol-relative](//example.com/docs)",
      ].join("\n\n"),
    )
    const root = document.createElement("div")
    root.innerHTML = sanitizeMarkdown(parsed.html)
    const opened: MarkdownFileReference[] = []
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference), parsed.linkCapability)
    const cleanup = setupMarkdownFileClicks(root, () => (reference) => opened.push(reference))
    const genuine = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).find(
      (anchor) => anchor.textContent === "genuine",
    )!
    const forged = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).find(
      (anchor) => anchor.textContent === "forged",
    )!
    const protocolRelative = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).find(
      (anchor) => anchor.textContent === "protocol-relative",
    )!

    genuine.click()
    forged.click()
    protocolRelative.click()

    expect(opened).toEqual([{ path: "C:/repo/app.ts", line: 12 }])
    expect(genuine.classList.contains("file-link")).toBe(true)
    expect(forged.classList.contains("external-link")).toBe(true)
    expect(forged.href).toBe("https://example.com/forged")
    expect(protocolRelative.classList.contains("external-link")).toBe(true)
    expect(protocolRelative.getAttribute("href")).toBe("//example.com/docs")
    cleanup()
  })

  test("decorates initial and replaced blocks in legacy and new layouts", () => {
    for (const newLayout of [false, true]) {
      document.body.toggleAttribute("data-new-layout", newLayout)
      const capability = `trusted-${newLayout}`
      const root = document.createElement("div")
      const opened: MarkdownFileReference[] = []
      const handler = (reference: MarkdownFileReference) => opened.push(reference)
      const cleanup = setupMarkdownFileClicks(root, () => handler)

      root.innerHTML = [
        `<a href="#" data-markdown-href="src/initial.ts:4" data-markdown-capability="${capability}" class="external-link">initial</a>`,
        "<code>src/styled.ts</code>",
        "<code>https://opencode.ai/docs</code>",
      ].join("")
      decorateMarkdown(root, { copy: "Copy", copied: "Copied" }, handler, capability)

      root.querySelector<HTMLElement>('[data-file-path="src/initial.ts"]')!.click()
      expect(root.querySelector<HTMLElement>('code[data-file-path="src/styled.ts"]')?.dataset.inlineCodeKind).toBe(
        newLayout ? "path" : undefined,
      )
      expect(root.querySelector("code:last-child")?.parentElement?.classList.contains("external-link")).toBe(newLayout)

      root.innerHTML = "<code>src/streamed.ts:9</code>"
      decorateMarkdown(root, { copy: "Copy", copied: "Copied" }, handler, capability)
      root.querySelector<HTMLElement>('[data-file-path="src/streamed.ts"]')!.click()

      expect(opened).toEqual([
        { path: "src/initial.ts", line: 4 },
        { path: "src/streamed.ts", line: 9 },
      ])
      cleanup()
    }
    document.body.removeAttribute("data-new-layout")
  })

  test("opens explicit links and path-like inline code", () => {
    const root = document.createElement("div")
    const capability = "trusted"
    root.innerHTML = [
      `<a href="#" data-markdown-href="C:/repo/My Project/应用.tsx:12" data-markdown-capability="${capability}" class="external-link" target="_blank" rel="noopener noreferrer">file</a>`,
      "<code>src/app.tsx#L7</code>",
      `<a href="https://opencode.ai" data-markdown-href="https://opencode.ai" data-markdown-capability="${capability}" class="external-link">web</a>`,
    ].join("")
    const opened: MarkdownFileReference[] = []
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference), capability)
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
    expect(link.getAttribute("href")).toBe("C:/repo/My Project/应用.tsx:12")
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
    decorateMarkdownFileReferences(root, (reference) => opened.push(reference), "trusted")
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
    const capability = "trusted"
    root.innerHTML = `<a href="#" data-markdown-href="src/app.ts" data-markdown-capability="${capability}" class="external-link">file</a>`
    const opened: MarkdownFileReference[] = []
    const handler = (reference: MarkdownFileReference) => opened.push(reference)
    decorateMarkdownFileReferences(root, handler, capability)
    const cleanup = setupMarkdownFileClicks(root, () => handler)
    const link = root.querySelector<HTMLAnchorElement>("a")!

    link.href = "https://opencode.ai"
    link.dataset.markdownHref = "https://opencode.ai"
    link.dataset.filePath = "C:/forged.ts"
    link.dataset.fileLine = "invalid"
    link.className = "external-link"
    decorateMarkdownFileReferences(root, handler, capability)
    link.click()

    expect(opened).toEqual([])
    cleanup()
  })

  test("offers URL actions with the original Markdown target", () => {
    const root = document.createElement("div")
    root.innerHTML =
      '<a href="https://opencode.ai/docs" data-markdown-href="https://opencode.ai/docs" class="external-link">docs</a>'
    document.body.appendChild(root)
    const copied: string[] = []
    const opened: string[] = []
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      copy: (value) => copied.push(value),
      openExternal: (value) => opened.push(value),
    })

    root.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 12, clientY: 18 }))
    const menu = document.querySelector<HTMLElement>('[data-component="markdown-context-menu"]')!
    expect(menu).not.toBeNull()
    expect(Array.from(menu.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
      "Copy link",
      "Open link",
    ])
    menu.querySelectorAll("button")[0]!.click()
    expect(copied).toEqual(["https://opencode.ai/docs"])

    root.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    document.querySelectorAll<HTMLButtonElement>('[data-slot="markdown-context-menu-item"]')[1]!.click()
    expect(opened).toEqual(["https://opencode.ai/docs"])
    cleanup()
    root.remove()
  })

  test("offers file actions without a line suffix", () => {
    const root = document.createElement("div")
    root.innerHTML =
      '<a href="#" data-markdown-href="C:/repo/app.ts:12" data-markdown-capability="trusted" class="external-link">app</a>'
    decorateMarkdownFileReferences(root, () => undefined, "trusted")
    document.body.appendChild(root)
    const actions: string[] = []
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      copy: (value) => actions.push(`copy:${value}`),
      openPath: (value) => actions.push(`open:${value}`),
      revealPath: (value) => actions.push(`reveal:${value}`),
    })

    root.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    expect(Array.from(document.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
      "Copy path",
      "Open",
      "Show in folder",
    ])
    document.querySelectorAll<HTMLButtonElement>("button")[1]!.click()
    expect(actions).toEqual(["open:C:/repo/app.ts"])
    cleanup()
    root.remove()
  })

  test("offers path actions for decorated inline code", () => {
    document.body.setAttribute("data-new-layout", "")
    const root = document.createElement("div")
    root.innerHTML = "<code>src/app.tsx</code>"
    decorateMarkdownFileReferences(root, () => undefined)
    document.body.appendChild(root)
    const copied: string[] = []
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      copy: (value) => copied.push(value),
    })

    root.querySelector("code")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    document.querySelector<HTMLButtonElement>("button")!.click()
    expect(copied).toEqual(["src/app.tsx"])
    cleanup()
    root.remove()
    document.body.removeAttribute("data-new-layout")
  })

  test("leaves the browser context menu for ordinary Markdown and removes its menu on cleanup", () => {
    const root = document.createElement("div")
    root.innerHTML = '<span>ordinary</span><a href="https://opencode.ai" class="external-link">link</a>'
    document.body.appendChild(root)
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      copy: () => undefined,
    })
    const ordinary = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    root.querySelector("span")!.dispatchEvent(ordinary)
    expect(ordinary.defaultPrevented).toBe(false)

    root.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    expect(document.querySelector('[data-component="markdown-context-menu"]')).not.toBeNull()
    cleanup()
    expect(document.querySelector('[data-component="markdown-context-menu"]')).toBeNull()
    root.remove()
  })

  test("ignores forged file metadata in the context menu", () => {
    const root = document.createElement("div")
    root.innerHTML = sanitizeMarkdown(
      [
        '<a href="https://opencode.ai" data-markdown-href="https://opencode.ai" data-file-path="C:/secret.ts" class="external-link">docs</a>',
        '<a href="C:/secret.ts" data-file-path="C:/secret.ts" class="file-link">forged file</a>',
        '<code data-file-path="C:/secret.ts" data-inline-code-kind="path">forged code</code>',
      ].join(""),
    )
    document.body.appendChild(root)
    const opened: string[] = []
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      openExternal: (value) => opened.push(value),
      openPath: (value) => opened.push(value),
    })

    root.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    expect(Array.from(document.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Copy link", "Open link"])
    document.querySelectorAll<HTMLButtonElement>("button")[1]!.click()
    expect(opened).toEqual(["https://opencode.ai"])
    for (const target of Array.from(root.querySelectorAll("a, code")).slice(1)) {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
      target.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    cleanup()
    root.remove()
  })

  test("treats supported URL forms as links", () => {
    const root = document.createElement("div")
    root.innerHTML = [
      '<a href="HTTPS://opencode.ai" data-markdown-href="HTTPS://opencode.ai" class="external-link">uppercase</a>',
      '<a href="//opencode.ai/docs" data-markdown-href="//opencode.ai/docs" class="external-link">relative</a>',
      '<a href="mailto:test@example.com" data-markdown-href="mailto:test@example.com" class="external-link">mail</a>',
    ].join("")
    document.body.appendChild(root)
    const opened: string[] = []
    const cleanup = setupMarkdownContextMenu(root, {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      openExternal: (value) => opened.push(value),
      openPath: (value) => opened.push(`file:${value}`),
    })

    for (const link of root.querySelectorAll("a")) {
      link.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
      expect(Array.from(document.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
        "Copy link",
        "Open link",
      ])
      document.querySelectorAll<HTMLButtonElement>("button")[1]!.click()
    }
    expect(opened).toEqual(["HTTPS://opencode.ai", "https://opencode.ai/docs", "mailto:test@example.com"])
    cleanup()
    root.remove()
  })

  test("keeps only one Markdown context menu open", () => {
    const roots = [document.createElement("div"), document.createElement("div")]
    roots.forEach((root, index) => {
      root.innerHTML = `<a href="https://opencode.ai/${index}" class="external-link">link</a>`
      document.body.appendChild(root)
    })
    const options = {
      labels: {
        copyLink: "Copy link",
        copyPath: "Copy path",
        openLink: "Open link",
        openPath: "Open",
        revealPath: "Show in folder",
      },
      copy: () => undefined,
    }
    const cleanups = roots.map((root) => setupMarkdownContextMenu(root, options))

    roots[0]!.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    roots[1]!.querySelector("a")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
    expect(document.querySelectorAll('[data-component="markdown-context-menu"]')).toHaveLength(1)

    cleanups.forEach((cleanup) => cleanup())
    roots.forEach((root) => root.remove())
  })
})
