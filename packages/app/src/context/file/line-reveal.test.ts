import { describe, expect, test } from "bun:test"
import { createFileLineRevealController, createFileRestoreScheduler } from "./line-reveal"

function createFrames() {
  let next = 0
  const queue = new Map<number, () => void>()
  return {
    request(callback: () => void) {
      const id = ++next
      queue.set(id, callback)
      return id
    },
    cancel(id: number) {
      queue.delete(id)
    },
    flush() {
      const current = Array.from(queue.values())
      queue.clear()
      current.forEach((callback) => callback())
    },
    pending: () => queue.size,
  }
}

function setup() {
  const frames = createFrames()
  const controller = createFileLineRevealController({
    requestFrame: (callback) => frames.request(callback),
    cancelFrame: (id) => frames.cancel(id),
  })
  return { frames, controller }
}

describe("createFileLineRevealController", () => {
  test("reveals only after an independently queued restore frame", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    frames.request(() => calls.push("restore"))
    controller.register("src/a.ts", (line) => {
      calls.push(`reveal:${line}`)
      return true
    })

    controller.request("src/a.ts", 12)
    frames.flush()
    expect(calls).toEqual(["restore", "reveal:12"])
  })

  test("reschedules a queued reveal through the production restoration boundary", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(`reveal:${line}`)
      return true
    })
    const restore = createFileRestoreScheduler({
      requestFrame: (callback) => frames.request(callback),
      cancelFrame: (id) => frames.cancel(id),
      restore: () => calls.push("restore"),
      onQueued: () => controller.restoreQueued("src/a.ts"),
    })

    controller.request("src/a.ts", 12)
    restore.queue()
    frames.flush()
    expect(calls).toEqual(["restore", "reveal:12"])
  })

  test("keeps a successful reveal authoritative over a later restoration", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    let position = "stored"
    controller.register("src/a.ts", (line) => {
      calls.push(`reveal:${line}`)
      position = `line:${line}`
      return true
    })
    const restore = createFileRestoreScheduler({
      requestFrame: (callback) => frames.request(callback),
      cancelFrame: (id) => frames.cancel(id),
      restore: () => {
        calls.push("restore")
        position = "stored"
      },
      onQueued: () => controller.restoreQueued("src/a.ts"),
    })

    controller.request("src/a.ts", 12)
    frames.flush()
    expect(position).toBe("line:12")

    restore.queue()
    frames.flush()

    expect(calls).toEqual(["reveal:12", "restore", "reveal:12"])
    expect(position).toBe("line:12")
  })

  test("supersedes a pending file globally when a later file is requested", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(`a:${line}`)
      return true
    })
    controller.register("src/b.ts", (line) => {
      calls.push(`b:${line}`)
      return true
    })

    controller.request("src/a.ts", 3)
    controller.request("src/b.ts", 8)
    frames.flush()

    expect(calls).toEqual(["b:8"])
  })

  test("keeps the active intent when an unrelated file view deactivates", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 12)
    frames.flush()
    controller.deactivate("src/b.ts")
    controller.restoreQueued("src/a.ts")
    frames.flush()

    expect(calls).toEqual([12, 12])
  })

  test("ends the active intent when its target file view deactivates", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 12)
    frames.flush()
    controller.deactivate("src/a.ts")
    controller.restoreQueued("src/a.ts")
    frames.flush()

    expect(calls).toEqual([12])
    expect(frames.pending()).toBe(0)
  })

  test("cancels a pending request before later viewer registration", () => {
    const { frames, controller } = setup()
    const calls: number[] = []

    controller.request("src/a.ts", 4)
    controller.cancel()
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    frames.flush()

    expect(calls).toEqual([])
    expect(frames.pending()).toBe(0)
  })

  test("ends a successful intent when its registered viewer unmounts", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    const unregister = controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 5)
    frames.flush()
    unregister()
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    controller.restoreQueued("src/a.ts")
    frames.flush()

    expect(calls).toEqual([5])
    expect(frames.pending()).toBe(0)
  })

  test("ends a successful intent when navigation cancels it", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 6)
    frames.flush()
    controller.cancel()
    controller.restoreQueued("src/a.ts")
    frames.flush()

    expect(calls).toEqual([6])
    expect(frames.pending()).toBe(0)
  })

  test("ends a successful intent when the provider disposes", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 7)
    frames.flush()
    controller.dispose()
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    controller.restoreQueued("src/a.ts")
    frames.flush()

    expect(calls).toEqual([7])
    expect(frames.pending()).toBe(0)
  })

  test("does not let stale cleanup unregister a replacement viewer", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    const unregister = controller.register("src/a.ts", () => {
      calls.push("stale")
      return true
    })
    controller.register("src/a.ts", () => {
      calls.push("current")
      return true
    })

    unregister()
    controller.request("src/a.ts", 5)
    frames.flush()

    expect(calls).toEqual(["current"])
  })

  test("retains a request until a delayed viewer can reveal it", () => {
    const { frames, controller } = setup()
    const calls: number[] = []

    controller.request("src/a.ts", 7)
    frames.flush()
    expect(calls).toEqual([])

    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    frames.flush()

    expect(calls).toEqual([7])
  })

  test("retries after render and keeps repeated same-line requests distinct", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    let ready = false
    controller.register("src/a.ts", (line) => {
      if (!ready) return false
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 9)
    frames.flush()
    expect(calls).toEqual([])

    ready = true
    controller.restoreQueued("src/a.ts")
    frames.flush()
    controller.request("src/a.ts", 9)
    frames.flush()

    expect(calls).toEqual([9, 9])
  })
})
