import { inlineCodeKind } from "./markdown-inline-code-kind"

export type MarkdownFileReference = { path: string; line?: number }
export type MarkdownFileOpenHandler = (reference: MarkdownFileReference) => void

export function parseMarkdownFileReference(
  value: string,
  source: "link" | "inline",
): MarkdownFileReference | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  if (/^(https?|mailto):/i.test(raw)) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw) && !/^file:\/\//i.test(raw)) return undefined

  const hash = raw.match(/#L(\d+)$/i)
  const colon = hash ? undefined : raw.match(/:(\d+)$/)
  const lineText = hash?.[1] ?? colon?.[1]
  const withoutLine = lineText ? raw.slice(0, -(hash?.[0].length ?? colon![0].length)) : raw
  const fileURL = /^file:\/\//i.test(withoutLine)
  const path = fileURL ? parseFileURL(withoutLine) : decode(withoutLine)
  if (path === undefined) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) return undefined
  if (!looksLikePath(path, source)) return undefined

  const line = lineText ? Number(lineText) : undefined
  if (line !== undefined && (!Number.isSafeInteger(line) || line < 1)) return undefined
  return line === undefined ? { path } : { path, line }
}

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function parseFileURL(value: string): string | undefined {
  const input = value.slice("file://".length)
  const separator = input.search(/[\\/]/)
  const authority = decode(separator === -1 ? input : input.slice(0, separator))
  const inputPath = decode(separator === -1 ? "" : input.slice(separator))
  if (authority === undefined || inputPath === undefined) return undefined
  if (hasControlCharacters(authority) || hasControlCharacters(inputPath)) return undefined
  if (authority === "." || authority === "..") return undefined
  if (authority && inputPath.split(/[\\/]/).some((part) => part === "." || part === "..")) return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== "file:" || url.username || url.password || url.port || url.search || url.hash) return undefined
    const path = decode(url.pathname)
    if (!path || path === "/") return undefined
    if (hasControlCharacters(url.hostname) || hasControlCharacters(path)) return undefined
    if (url.hostname === "." || url.hostname === "..") return undefined
    if (url.hostname) {
      const share = path.startsWith("/") ? path.slice(1).split(/[\\/]/)[0] : undefined
      if (!share || share === "." || share === "..") return undefined
      return `\\\\${url.hostname}${path.replaceAll("/", "\\")}`
    }
    if (/^\/[a-z]:[\\/]/i.test(path)) return path.slice(1)
    if (path.startsWith("/")) return path
    return undefined
  } catch {
    return undefined
  }
}

function looksLikePath(path: string, source: "link" | "inline") {
  if (/^@[^/\\\s]+[/\\][^/\\\s]+$/.test(path)) return false
  if (/^[a-z]:[\\/]/i.test(path)) return true
  if (/^\\\\[^\\]/.test(path)) return true
  if (path.startsWith("/")) return true
  if (/^\.\.?[\\/]/.test(path)) return true
  if (source === "link" && /\s/.test(path)) {
    if (/[/\\]/.test(path)) return true
    return inlineCodeKind(path.split(/\s+/).at(-1) ?? "") === "path"
  }
  if (source === "inline" && /\s/.test(path)) return /[/\\]/.test(path)
  if (/\s/.test(path)) return false
  return inlineCodeKind(path) === "path"
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || (code >= 127 && code <= 159)
  })
}
