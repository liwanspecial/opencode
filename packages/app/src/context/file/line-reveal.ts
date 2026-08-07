type LineRevealer = (line: number) => boolean

export function createFileRestoreScheduler(input: {
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
  restore: () => void
  onQueued: () => void
}) {
  let frame: number | undefined

  return {
    queue() {
      if (frame !== undefined) return
      frame = input.requestFrame(() => {
        frame = undefined
        input.restore()
      })
      input.onQueued()
    },
    dispose() {
      if (frame === undefined) return
      input.cancelFrame(frame)
      frame = undefined
    },
  }
}

export function createFileLineRevealController(input: {
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
}) {
  let version = 0
  let registration = 0
  let firstFrame: number | undefined
  let secondFrame: number | undefined
  let pending: { version: number; path: string; line: number } | undefined
  const revealers = new Map<string, { id: number; reveal: LineRevealer }>()

  const cancelFrames = () => {
    if (firstFrame !== undefined) input.cancelFrame(firstFrame)
    if (secondFrame !== undefined) input.cancelFrame(secondFrame)
    firstFrame = undefined
    secondFrame = undefined
  }

  const cancel = () => {
    version++
    pending = undefined
    cancelFrames()
  }

  const schedule = () => {
    if (!pending) return
    if (firstFrame !== undefined || secondFrame !== undefined) return
    const expected = pending.version
    firstFrame = input.requestFrame(() => {
      firstFrame = undefined
      if (pending?.version !== expected) return
      secondFrame = input.requestFrame(() => {
        secondFrame = undefined
        const request = pending
        if (!request || request.version !== expected) return
        if (!revealers.get(request.path)?.reveal(request.line)) return
        if (pending?.version === expected) pending = undefined
      })
    })
  }

  return {
    request(path: string, line: number) {
      cancelFrames()
      pending = { version: ++version, path, line }
      schedule()
    },
    cancel,
    register(path: string, reveal: LineRevealer) {
      const id = ++registration
      revealers.set(path, { id, reveal })
      if (pending?.path === path) schedule()
      return () => {
        if (revealers.get(path)?.id !== id) return
        revealers.delete(path)
        if (pending?.path === path) cancel()
      }
    },
    rendered(path: string) {
      if (pending?.path !== path) return
      cancelFrames()
      schedule()
    },
    dispose() {
      cancel()
      revealers.clear()
    },
  }
}
