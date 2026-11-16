import { expect, test } from "bun:test"
import { NodeFileSystem } from "@effect/platform-node"
import { mkdir, mkdtemp, rm, symlink, truncate, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, FileSystem } from "effect"
import { createSettingsStore } from "../storage/store"
import { MAX_ATTACHMENT_BYTES } from "./attachment-picker"
import { createBackgroundImages } from "./background-image"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bQ5sAAAAASUVORK5CYII=",
  "base64",
)

async function fixture(run: (input: { directory: string; file: string; settings: string }) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "opencode-background-"))
  const file = join(directory, "背景 image.PNG")
  const settings = join(directory, "opencode.settings")
  try {
    await writeFile(file, png)
    await run({ directory, file, settings })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function images(settings: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return createBackgroundImages(fs, createSettingsStore(settings))
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  )
}

test("only the native selection survives reopening and clearing the settings", async () => {
  await fixture(async ({ directory, file, settings }) => {
    const other = join(directory, "unselected.png")
    await writeFile(other, png)
    const initial = await images(settings)
    expect(await Effect.runPromise(initial.read(file))).toBeNull()
    expect(await Effect.runPromise(initial.select(file))).toBe(file)

    const reopened = await images(settings)
    const approved = await Effect.runPromise(reopened.read(file))
    expect(approved?.mime).toBe("image/png")
    expect(approved?.bytes).toEqual(new Uint8Array(png))
    expect(await Effect.runPromise(reopened.read(other))).toBeNull()
    await Effect.runPromise(reopened.clear())
    expect(await Effect.runPromise((await images(settings)).read(file))).toBeNull()
  })
})

test.each([
  { name: "mismatched image suffix", filename: "mismatched.jpg", prepare: (file: string) => writeFile(file, png) },
  { name: "non-image bytes", filename: "markup.png", prepare: (file: string) => writeFile(file, "<svg/>") },
  { name: "a directory", filename: "folder.png", prepare: (file: string) => mkdir(file) },
  {
    name: "an oversized file",
    filename: "oversized.png",
    prepare: async (file: string) => {
      await writeFile(file, png)
      await truncate(file, MAX_ATTACHMENT_BYTES + 1)
    },
  },
])("rejects $name without replacing the approved image", async ({ filename, prepare }) => {
  await fixture(async ({ directory, file, settings }) => {
    const access = await images(settings)
    expect(await Effect.runPromise(access.select(file))).toBe(file)
    const invalid = join(directory, filename)
    await prepare(invalid)
    await expect(Effect.runPromise(access.select(invalid))).rejects.toThrow("background-image.invalid-selection")
    expect(await Effect.runPromise(access.read(invalid))).toBeNull()
    expect((await Effect.runPromise(access.read(file)))?.mime).toBe("image/png")
  })
})

test("a missing approved file can return without another picker grant", async () => {
  await fixture(async ({ file, settings }) => {
    const access = await images(settings)
    expect(await Effect.runPromise(access.select(file))).toBe(file)
    await unlink(file)
    expect(await Effect.runPromise(access.read(file))).toBeNull()
    await writeFile(file, png)
    expect((await Effect.runPromise(access.read(file)))?.mime).toBe("image/png")
  })
})

test("a failed settings write leaves the current image authorized", async () => {
  await fixture(async ({ directory, file, settings }) => {
    const access = await images(settings)
    expect(await Effect.runPromise(access.select(file))).toBe(file)
    const replacement = join(directory, "replacement.png")
    await writeFile(replacement, png)
    await mkdir(settings + ".tmp")
    await expect(Effect.runPromise(access.select(replacement))).rejects.toThrow()
    expect(await Effect.runPromise(access.read(replacement))).toBeNull()
    expect((await Effect.runPromise(access.read(file)))?.mime).toBe("image/png")
  })
})

test("rejects an approved path after its directory link is retargeted", async () => {
  await fixture(async ({ directory, settings }) => {
    const original = join(directory, "original")
    const replacement = join(directory, "replacement")
    const alias = join(directory, "alias")
    await mkdir(original)
    await mkdir(replacement)
    await writeFile(join(original, "image.png"), png)
    await writeFile(join(replacement, "image.png"), png)
    await symlink(original, alias, "junction")
    const file = join(alias, "image.png")
    const access = await images(settings)
    expect(await Effect.runPromise(access.select(file))).toBe(file)
    expect((await Effect.runPromise(access.read(file)))?.mime).toBe("image/png")
    await unlink(alias)
    await symlink(replacement, alias, "junction")
    expect(await Effect.runPromise(access.read(file))).toBeNull()
  })
})
