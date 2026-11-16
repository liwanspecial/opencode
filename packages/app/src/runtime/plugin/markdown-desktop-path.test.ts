import { expect, test } from "bun:test"
import { resolveMarkdownDesktopPath } from "./markdown-desktop-path"

const windows = { local: true, os: "windows", directory: "C:\\work\\my project" } as const

test.each([
  {
    name: "relative path keeps decoded filename characters",
    input: { ...windows, path: "src/a #50%20.ts" },
    expected: "C:\\work\\my project\\src\\a #50%20.ts",
  },
  {
    name: "native absolute path outside the workspace",
    input: { ...windows, path: "D:/other folder/a.ts" },
    expected: "D:\\other folder\\a.ts",
  },
  {
    name: "remote server cannot launch a matching local-looking path",
    input: { ...windows, local: false, path: "C:/work/my project/a.ts" },
    expected: undefined,
  },
  {
    name: "unknown session location",
    input: { ...windows, directory: undefined, path: "C:/work/a.ts" },
    expected: undefined,
  },
  {
    name: "Windows cannot open an unmapped Linux absolute path",
    input: { ...windows, path: "/home/user/a.ts" },
    expected: undefined,
  },
  {
    name: "Windows rejects drive-relative paths",
    input: { ...windows, path: "D:a.ts" },
    expected: undefined,
  },
  {
    name: "Windows rejects network shares",
    input: { ...windows, path: "//server/share/a.ts" },
    expected: undefined,
  },
  {
    name: "Windows rejects device paths",
    input: { ...windows, path: "\\\\.\\pipe\\a" },
    expected: undefined,
  },
  {
    name: "Windows can use the workspace's explicit WSL mapping",
    input: { ...windows, directory: "\\\\wsl.localhost\\Ubuntu\\home\\dev\\project", path: "src/a.ts" },
    expected: "\\\\wsl.localhost\\Ubuntu\\home\\dev\\project\\src\\a.ts",
  },
  {
    name: "Windows cannot switch to another WSL distribution",
    input: { ...windows, directory: "\\\\wsl.localhost\\Ubuntu\\home\\dev", path: "//wsl$/Debian/home/dev/a.ts" },
    expected: undefined,
  },
  {
    name: "POSIX relative path",
    input: { local: true, os: "linux" as const, directory: "/home/dev/project", path: "a #1.ts" },
    expected: "/home/dev/project/a #1.ts",
  },
  {
    name: "virtual skill path cannot launch a local app",
    input: { local: true, os: "linux" as const, directory: "/home/dev/project", path: "skill://opencode/SKILL.md" },
    expected: undefined,
  },
])("resolves $name", ({ input, expected }) => {
  expect(resolveMarkdownDesktopPath(input)).toBe(expected)
})
