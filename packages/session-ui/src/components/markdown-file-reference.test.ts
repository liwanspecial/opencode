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
    ["docs/My File.md", "link", { path: "docs/My File.md" }],
    ["docs/My%20File.md", "link", { path: "docs/My File.md" }],
    ["My File.md", "link", { path: "My File.md" }],
    ["My%20File.md", "link", { path: "My File.md" }],
    ["file:///repo/My%20File.ts%23L4#L8", "link", { path: "/repo/My File.ts#L4", line: 8 }],
    ["file:///tmp/opencode/app.ts", "link", { path: "/tmp/opencode/app.ts" }],
    ["file://server/share/app.ts", "link", { path: "\\\\server\\share\\app.ts" }],
    ["../packages/session-ui", "inline", { path: "../packages/session-ui" }],
    ["\\\\server\\share\\app.ts", "link", { path: "\\\\server\\share\\app.ts" }],
  ] as const)("parses %s", (value, source, expected) => {
    expect(parseMarkdownFileReference(value, source)).toEqual(expected)
  })

  test.each([
    "https://opencode.ai/docs",
    "http://localhost:4444",
    "mailto:test@example.com",
    "javascript:alert(1)",
    "vscode://file/repo/app.tsx",
    "plain words",
    "plain%20words",
    "app.tsx:not-a-line",
    "app.tsx:0",
    "app.tsx#L0",
    "@scope/name",
    "javascript%3Aalert.ts",
    "file://",
    "file:///",
    "file://server/",
    "file://server//",
    "file://server/%2F",
    "file://server/%2f%2f",
    "file://./C:/Windows/System32",
    "file://%2e/C:/Windows/System32",
    "file://../C:/Windows/System32",
    "file://%2e%2e/C:/Windows/System32",
    "file://server/%2e/app.ts",
    "file://server/%2e%2e/share/app.ts",
    "file://server/share%00/app.ts",
    "file:///tmp/app%00.ts",
    "file:///tmp/app%0A.ts",
    "file:///tmp/app%1F.ts",
    "file:///tmp/app%7F.ts",
    "file:///tmp/app%C2%85.ts",
    "file://javascript%3Aalert(1)",
    "file://[bad]/app.ts",
    "file:///repo/bad%ZZ.ts",
  ])("rejects %s", (value) => {
    expect(parseMarkdownFileReference(value, "link")).toBeUndefined()
  })

  test("only accepts whitespace inline references when they contain a path separator", () => {
    expect(parseMarkdownFileReference("My File.md", "inline")).toBeUndefined()
    expect(parseMarkdownFileReference("docs/My File.md", "inline")).toEqual({ path: "docs/My File.md" })
  })
})
