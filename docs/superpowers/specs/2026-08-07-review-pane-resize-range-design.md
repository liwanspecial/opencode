# Review Pane Resize Range Design

## Goal

Allow the divider between the session panel and the right review pane to move farther right, so users can allocate more width to the session panel when needed.

## Design

Keep the existing one-to-one drag behavior, persisted session width, and shared `ResizeHandle` unchanged. The range is currently limited by fixed minimum widths reserved for the review pane, so reduce those limits as follows:

- Unified diff review pane: `480px` to `360px`.
- Split diff review pane: `800px` to `640px`.

The session panel retains its existing `450px` minimum. On windows too narrow to satisfy both panes, the current clamping behavior continues to prioritize that session minimum.

## Scope

Change only the review pane width constants and their focused unit tests. Do not alter the review file-list sidebar, drag sensitivity, width persistence, responsive breakpoint, or panel rendering.

## Verification

- Unit tests assert the new unified and split review pane minimums.
- Unit tests assert the resulting maximum session width for both diff modes.
- Existing small-window clamping behavior remains covered.
- Run the focused width tests and the app package typecheck.
