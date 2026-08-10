// The review pane has no width of its own: it takes whatever the chat panel
// leaves behind. Instead of capping the chat panel at a fraction of the window
// (which forces the review pane to grow with the monitor), reserve a fixed
// minimum for the review pane and let the chat panel take everything else.
export const SESSION_PANEL_WIDTH_MIN = 450
export const REVIEW_PANE_WIDTH_MIN = 280
export const REVIEW_PANE_WIDTH_MIN_SPLIT = 640
const TERMINAL_PANE_WIDTH_MIN = 360

export function sessionPanelWidthMax(input: { available: number; review: boolean; split: boolean }) {
  const pane = input.split
    ? REVIEW_PANE_WIDTH_MIN_SPLIT
    : input.review
      ? REVIEW_PANE_WIDTH_MIN
      : TERMINAL_PANE_WIDTH_MIN
  return Math.max(SESSION_PANEL_WIDTH_MIN, input.available - pane)
}

// `available` is undefined until the layout row is first measured; render the
// stored width untouched until then to avoid a first-frame snap.
export function clampSessionPanelWidth(input: {
  width: number
  available: number | undefined
  review: boolean
  split: boolean
}) {
  if (input.available === undefined) return input.width
  return Math.min(
    input.width,
    sessionPanelWidthMax({ available: input.available, review: input.review, split: input.split }),
  )
}
