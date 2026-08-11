import { expect, test } from "bun:test"
import { isMermaidBlock, isMermaidLanguage } from "./markdown-mermaid"

test("detects mermaid code fence language case-insensitively", () => {
  expect(isMermaidLanguage("mermaid")).toBe(true)
  expect(isMermaidLanguage("Mermaid")).toBe(true)
  expect(isMermaidLanguage("MERMAID")).toBe(true)
})

test("does not treat missing or other code fence languages as mermaid", () => {
  expect(isMermaidLanguage(undefined)).toBe(false)
  expect(isMermaidLanguage("ts")).toBe(false)
  expect(isMermaidLanguage("mermaid-js")).toBe(false)
})

test("detects unlabeled mermaid diagrams by content", () => {
  expect(
    isMermaidBlock(
      undefined,
      `sequenceDiagram
        participant C as 车端客户端
        participant B as 业务云端
        C->>B: POST /auth/token`,
    ),
  ).toBe(true)
})

test("does not treat ordinary unlabeled code as mermaid", () => {
  expect(isMermaidBlock(undefined, `const value = "sequenceDiagram"`)).toBe(false)
  expect(isMermaidBlock("ts", `sequenceDiagram\nA->>B: hello`)).toBe(false)
})
