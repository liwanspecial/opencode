import { expect, test } from "bun:test"
import { createMarkdownParser } from "./marked-parser"

const parser = createMarkdownParser((code, language) => `<pre data-language="${language}">${code}</pre>`)

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

test("renders inline and block math", async () => {
  expect(await parser.parse("\\(x^2\\)")).toContain('<span class="katex">')
  expect(await parser.parse("$$\nx^2\n$$\n")).toContain('<span class="katex-display">')
})

test("uses the configured code highlighter", async () => {
  expect(await parser.parse("```ts\nconst value = 1\n```\n")).toBe('<pre data-language="ts">const value = 1</pre>\n')
})
