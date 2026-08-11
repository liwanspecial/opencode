// The right pane takes whatever the session panel leaves behind. Review can be
// dragged closed, while a terminal-only pane keeps a usable minimum width.
export const SESSION_PANEL_WIDTH_MIN = 450
const TERMINAL_PANE_WIDTH_MIN = 360

export function sessionPanelWidthMax(input: { available: number; review: boolean }) {
  const pane = input.review ? 0 : TERMINAL_PANE_WIDTH_MIN
  return Math.max(SESSION_PANEL_WIDTH_MIN, input.available - pane)
}

// `available` is undefined until the layout row is first measured; render the
// stored width untouched until then to avoid a first-frame snap.
export function clampSessionPanelWidth(input: {
  width: number
  available: number | undefined
  review: boolean
}) {
  if (input.available === undefined) return input.width
  return Math.min(
    input.width,
    sessionPanelWidthMax({ available: input.available, review: input.review }),
  )
}
