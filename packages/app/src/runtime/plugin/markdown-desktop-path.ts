import type { Platform } from "@/runtime/platform/platform"

const drive = /^[a-z]:\\/i

const wsl = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(?:\\|$)/i

/** Resolves an already decoded Markdown file path for the native desktop shell. */
export function resolveMarkdownDesktopPath(input: {
  local: boolean
  os: Platform["os"]
  directory: string | undefined
  path: string
}) {
  if (!input.local || !input.directory || !input.path || input.path.includes("\0") || input.path.includes("://"))
    return

  if (input.os === "windows") {
    const directory = input.directory.replaceAll("/", "\\")
    const path = input.path.replaceAll("/", "\\")
    const distribution = directory.match(wsl)?.[1]?.toLowerCase()

    if (!drive.test(directory) && !distribution) return

    if (drive.test(path)) return path

    if (path.startsWith("\\\\")) {
      // A WSL share is usable only when the workspace already uses that distribution's native mapping.
      if (distribution && path.match(wsl)?.[1]?.toLowerCase() === distribution) return path
      return
    }

    if (path.startsWith("\\") || path.includes(":")) return

    return `${directory.replace(/\\+$/, "")}\\${path}`
  }

  if (input.os !== "linux" && input.os !== "macos") return

  if (!input.directory.startsWith("/") || input.path.startsWith("//") || /^(?:[a-z]:|\\)/i.test(input.path)) return

  return input.path.startsWith("/") ? input.path : `${input.directory.replace(/\/+$/, "")}/${input.path}`
}
