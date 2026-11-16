import path from "node:path"
import { Effect, FileSystem, Option, Schema } from "effect"
import { BACKGROUND_IMAGE_GRANT_KEY } from "../storage/keys"
import type { SettingsStore } from "../storage/store"
import { MAX_ATTACHMENT_BYTES, readAttachment } from "./attachment-picker"

const Grant = Schema.Struct({ path: Schema.String, target: Schema.String })
const decodeGrant = Schema.decodeUnknownOption(Grant)

const imageTypes = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const

export const backgroundImageExtensions = Object.keys(imageTypes)

export function createBackgroundImages(fs: FileSystem.FileSystem, settings: SettingsStore) {
  const grant = () => Option.getOrUndefined(decodeGrant(settings.get(BACKGROUND_IMAGE_GRANT_KEY)))

  return {
    // Only a successful native picker may create this grant. Renderer storage never writes it.
    select: Effect.fn("DesktopFiles.selectBackgroundImage")(function* (file: string) {
      const target = yield* resolve(file)
      if (!target || !(yield* load(file, target)))
        return yield* Effect.fail(new Error("background-image.invalid-selection"))
      return yield* Effect.try(() => {
        settings.set(BACKGROUND_IMAGE_GRANT_KEY, { path: file, target })
        return file
      })
    }),
    read: Effect.fn("DesktopFiles.readBackgroundImage")(function* (file: string) {
      const approved = grant()
      if (!approved || approved.path !== file) return null
      const target = yield* resolve(file)
      if (target !== approved.target) return null
      const image = yield* load(file, target)
      // Another window may have replaced or cleared the grant while this file was being read.
      const current = grant()
      return current?.path === file && current.target === target ? image : null
    }),
    clear: () =>
      Effect.try(() => {
        if (settings.get(BACKGROUND_IMAGE_GRANT_KEY) !== undefined) settings.delete(BACKGROUND_IMAGE_GRANT_KEY)
      }),
  }

  function resolve(file: string) {
    if (!isLocalPath(file)) return Effect.succeed(undefined)
    return fs.realPath(file).pipe(
      Effect.map((target) => (isLocalPath(target) ? target : undefined)),
      Effect.orElseSucceed(() => undefined),
    )
  }

  function load(file: string, target: string) {
    return Effect.gen(function* () {
      const extension = path.extname(file).slice(1).toLowerCase()
      const mime = Object.entries(imageTypes).find(([key]) => key === extension)?.[1]
      if (!mime) return null
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info?.type !== "File" || Number(info.size) > MAX_ATTACHMENT_BYTES) return null
      const content = yield* readAttachment(target).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.catchCause(() => Effect.succeed(null)),
      )
      if (!content) return null
      const bytes = new Uint8Array(content)
      return imageMime(bytes) === mime ? { mime, bytes } : null
    })
  }
}

function isLocalPath(value: string) {
  if (value.includes("\0")) return false
  if (process.platform !== "win32") return path.isAbsolute(value)
  const windows = value.replaceAll("/", "\\")
  // Windows presents Linux files in its native picker through these local WSL shares.
  return (
    /^(?:\\\\\?\\)?[a-z]:\\/i.test(windows) ||
    /^\\\\(?:\?\\UNC\\)?(?:wsl\$|wsl\.localhost)\\[^\\]+\\[^\\]/i.test(windows)
  )
}

function imageMime(bytes: Uint8Array) {
  const header = Buffer.from(bytes.subarray(0, 12)).toString("latin1")
  if (header.startsWith("\x89PNG\r\n\x1a\n")) return "image/png"
  if (header.startsWith("\xff\xd8\xff")) return "image/jpeg"
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif"
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp"
}
