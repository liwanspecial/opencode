import { describe, expect, test } from "bun:test"
import { clampSessionPanelWidth, sessionPanelWidthMax } from "./session-panel-width"

describe("sessionPanelWidthMax", () => {
  test("allows the review pane to reach zero width", () => {
    expect(sessionPanelWidthMax({ available: 1700, review: true })).toBe(1700)
  })

  test("preserves the terminal-only pane minimum", () => {
    expect(sessionPanelWidthMax({ available: 1700, review: false })).toBe(1340)
  })

  test("lets the session panel take the full available width", () => {
    const available = 3440
    expect(sessionPanelWidthMax({ available, review: true })).toBe(available)
  })

  test("uses all available review width without dropping below the chat panel minimum", () => {
    expect(sessionPanelWidthMax({ available: 600, review: true })).toBe(600)
    expect(sessionPanelWidthMax({ available: 0, review: true })).toBe(450)
  })
})

describe("clampSessionPanelWidth", () => {
  test("keeps widths already within the limit", () => {
    expect(clampSessionPanelWidth({ width: 800, available: 1700, review: true })).toBe(800)
  })

  test("keeps review widths below the full available width", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 1700, review: true })).toBe(1600)
  })

  test("caps review widths at the full available width", () => {
    expect(clampSessionPanelWidth({ width: 1800, available: 1700, review: true })).toBe(1700)
  })

  test("uses all available width when review has no remaining space", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 700, review: true })).toBe(700)
  })

  test("skips clamping before the layout is measured", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: undefined, review: true })).toBe(1600)
  })
})
