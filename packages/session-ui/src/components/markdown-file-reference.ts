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
  const decoded = decode(fileURL ? withoutLine.slice("file://".length) : withoutLine)
  if (decoded === undefined) return undefined
  const path = fileURL && /^\/[a-z]:[\\/]/i.test(decoded) ? decoded.slice(1) : decoded
  if (!looksLikePath(path, source, fileURL)) return undefined

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

function looksLikePath(path: string, source: "link" | "inline", fileURL: boolean) {
  if (/^@[^/\\\s]+[/\\][^/\\\s]+$/.test(path)) return false
  if (fileURL) return true
  if (/^[a-z]:[\\/]/i.test(path)) return true
  if (/^\\\\[^\\]/.test(path)) return true
  if (path.startsWith("/")) return true
  if (/^\.\.?[\\/]/.test(path)) return true
  if (source === "inline" && /\s/.test(path)) return /[/\\]/.test(path)
  if (/\s/.test(path)) return false
  return inlineCodeKind(path) === "path"
}
