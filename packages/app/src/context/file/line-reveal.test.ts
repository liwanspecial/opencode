import { describe, expect, test } from "bun:test"
import { createFileLineRevealController } from "./line-reveal"

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
    expect(calls).toEqual(["restore"])

    frames.flush()
    expect(calls).toEqual(["restore", "reveal:12"])
  })

  test("reschedules a queued reveal behind a later render restoration", () => {
    const { frames, controller } = setup()
    const calls: string[] = []
    controller.register("src/a.ts", (line) => {
      calls.push(`reveal:${line}`)
      return true
    })

    controller.request("src/a.ts", 12)
    frames.flush()
    frames.request(() => calls.push("restore"))
    controller.rendered("src/a.ts")
    frames.flush()
    expect(calls).toEqual(["restore"])

    frames.flush()
    expect(calls).toEqual(["restore", "reveal:12"])
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
    frames.flush()

    expect(calls).toEqual(["b:8"])
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
    frames.flush()

    expect(calls).toEqual([])
    expect(frames.pending()).toBe(0)
  })

  test("cancels pending delivery when its registered viewer unmounts", () => {
    const { frames, controller } = setup()
    const calls: number[] = []
    const unregister = controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })

    controller.request("src/a.ts", 5)
    unregister()
    frames.flush()
    frames.flush()
    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    frames.flush()
    frames.flush()

    expect(calls).toEqual([])
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
    frames.flush()

    expect(calls).toEqual(["current"])
  })

  test("retains a request until a delayed viewer can reveal it", () => {
    const { frames, controller } = setup()
    const calls: number[] = []

    controller.request("src/a.ts", 7)
    frames.flush()
    frames.flush()
    expect(calls).toEqual([])

    controller.register("src/a.ts", (line) => {
      calls.push(line)
      return true
    })
    frames.flush()
    expect(calls).toEqual([])
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
    frames.flush()
    expect(calls).toEqual([])

    ready = true
    controller.rendered("src/a.ts")
    frames.flush()
    frames.flush()
    controller.request("src/a.ts", 9)
    frames.flush()
    frames.flush()

    expect(calls).toEqual([9, 9])
  })
})
