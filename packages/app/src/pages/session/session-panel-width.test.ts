import { describe, expect, test } from "bun:test"
import {
  clampSessionPanelWidth,
  REVIEW_PANE_WIDTH_MIN,
  REVIEW_PANE_WIDTH_MIN_SPLIT,
  sessionPanelWidthMax,
} from "./session-panel-width"

describe("sessionPanelWidthMax", () => {
  test("reserves the unified review pane minimum", () => {
    expect(REVIEW_PANE_WIDTH_MIN).toBe(280)
    expect(sessionPanelWidthMax({ available: 1700, review: true, split: false })).toBe(1420)
  })

  test("preserves the terminal-only pane minimum", () => {
    expect(sessionPanelWidthMax({ available: 1700, review: false, split: false })).toBe(1340)
  })

  test("reserves a larger minimum for split diffs", () => {
    expect(REVIEW_PANE_WIDTH_MIN_SPLIT).toBe(640)
    expect(sessionPanelWidthMax({ available: 1700, review: true, split: true })).toBe(
      1700 - REVIEW_PANE_WIDTH_MIN_SPLIT,
    )
    expect(REVIEW_PANE_WIDTH_MIN_SPLIT).toBeGreaterThan(REVIEW_PANE_WIDTH_MIN)
  })

  test("lets the chat panel take everything beyond the review pane minimum", () => {
    // Regression: the old cap was 45% of the window, forcing the review pane
    // to at least 55% of the window regardless of content.
    const available = 3440
    expect(sessionPanelWidthMax({ available, review: true, split: false })).toBeGreaterThan(available * 0.45)
  })

  test("never drops below the chat panel minimum on small windows", () => {
    expect(sessionPanelWidthMax({ available: 600, review: true, split: true })).toBe(450)
    expect(sessionPanelWidthMax({ available: 0, review: true, split: false })).toBe(450)
  })
})

describe("clampSessionPanelWidth", () => {
  test("keeps widths already within the limit", () => {
    expect(clampSessionPanelWidth({ width: 800, available: 1700, review: true, split: false })).toBe(800)
  })

  test("forces the width down when the window shrinks", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 1700, review: true, split: false })).toBe(
      1700 - REVIEW_PANE_WIDTH_MIN,
    )
    expect(clampSessionPanelWidth({ width: 1600, available: 1700, review: true, split: true })).toBe(
      1700 - REVIEW_PANE_WIDTH_MIN_SPLIT,
    )
  })

  test("holds the chat panel minimum when there is no room for both", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 700, review: true, split: true })).toBe(450)
  })

  test("skips clamping before the layout is measured", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: undefined, review: true, split: false })).toBe(1600)
  })
})
