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

test("escapes literal quotes in link destinations and titles", async () => {
  const html = await parser.parse(`[file](<src/a" onclick="alert(1).ts> 'say "hello"')`)
  expect(html).not.toContain(' onclick="')
  expect(html).toContain('href="src/a&quot; onclick=&quot;alert(1).ts"')
  expect(html).toContain('data-markdown-href="src/a&quot; onclick=&quot;alert(1).ts"')
  expect(html).toContain('title="say &quot;hello&quot;"')
})

test("preserves entity-encoded HTTPS link attributes", async () => {
  expect(await parser.parse('[OpenCode](<https://opencode.ai/search?q=a&amp;b=c> "A &quot;title&quot;")')).toContain(
    'href="https://opencode.ai/search?q=a&amp;b=c" data-markdown-href="https://opencode.ai/search?q=a&amp;b=c" title="A &quot;title&quot;"',
  )
})

test("preserves entity-encoded mailto link attributes", async () => {
  expect(await parser.parse("[email](<mailto:test@example.com?subject=A&amp;body=B>)")).toContain(
    'href="mailto:test@example.com?subject=A&amp;body=B" data-markdown-href="mailto:test@example.com?subject=A&amp;body=B"',
  )
})

test("renders inline and block math", async () => {
  expect(await parser.parse("\\(x^2\\)")).toContain('<span class="katex">')
  expect(await parser.parse("$$\nx^2\n$$\n")).toContain('<span class="katex-display">')
})

test("uses the configured code highlighter", async () => {
  expect(await parser.parse("```ts\nconst value = 1\n```\n")).toBe('<pre data-language="ts">const value = 1</pre>\n')
})
