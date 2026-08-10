# Review Pane Minimum Width Design

## Goal

Allow the unified review pane to be resized farther to the right by reducing its minimum width from 360px to 280px.

## Scope

- Change only the unified review pane minimum width.
- Keep the split diff minimum width at 640px.
- Keep the session chat panel minimum width at 450px.
- Do not add settings, persisted-state migrations, or new resize behavior.

## Implementation

Update `REVIEW_PANE_WIDTH_MIN` in `packages/app/src/pages/session/session-panel-width.ts` from 360 to 280. The existing `sessionPanelWidthMax` and `clampSessionPanelWidth` calculations continue to reserve the selected review-pane minimum while preserving the stored chat width.

Update the focused unit test to assert the new 280px unified minimum and retain coverage that split diffs reserve 640px and small windows preserve the chat minimum.

## Verification

- Run the focused session panel width unit test.
- Run the complete app unit and browser tests.
- Run app and desktop type checks.
- Build the desktop production bundle.
- Generate a Windows x64 NSIS installer for production channel version 1.18.15.
- Verify installer product identity, version, size, and SHA-256 hash.

## Expected Result

In unified review mode, users can drag the divider 80px farther to the right than before. Split diff readability and all persisted panel-width behavior remain unchanged.
