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
  let frame: number | undefined
  let intent: { path: string; line: number } | undefined
  const revealers = new Map<string, { reveal: LineRevealer }>()

  const cancelFrame = () => {
    if (frame !== undefined) input.cancelFrame(frame)
    frame = undefined
  }

  const cancel = () => {
    intent = undefined
    cancelFrame()
  }

  const deactivate = (path: string) => {
    if (intent?.path !== path) return
    cancel()
  }

  const schedule = () => {
    if (!intent || frame !== undefined) return
    const expected = intent
    frame = input.requestFrame(() => {
      frame = undefined
      if (intent !== expected) return
      revealers.get(expected.path)?.reveal(expected.line)
    })
  }

  return {
    request(path: string, line: number) {
      cancelFrame()
      intent = { path, line }
      schedule()
    },
    cancel,
    deactivate,
    register(path: string, reveal: LineRevealer) {
      const registration = { reveal }
      revealers.set(path, registration)
      if (intent?.path === path) schedule()
      return () => {
        if (revealers.get(path) !== registration) return
        revealers.delete(path)
        deactivate(path)
      }
    },
    restoreQueued(path: string) {
      if (intent?.path !== path) return
      cancelFrame()
      schedule()
    },
    dispose() {
      cancel()
      revealers.clear()
    },
  }
}
