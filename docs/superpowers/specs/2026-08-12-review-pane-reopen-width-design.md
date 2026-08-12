# Review Pane Reopen Width Design

## Goal

Ensure the right review pane is always visible when reopened, including after upgrading from a version that persisted a full-width session panel.

## Behavior

- Every transition from closed review to open review restores the right review pane to `480px`.
- The session panel width is derived as `available row width - 480px` because the existing layout persists the left session width.
- The session panel remains at least `450px` on smaller desktop windows; review receives the remaining width.
- Dragging review to `0%` still closes it immediately.
- Reopening after drag-close, header toggle-close, reload, or an upgrade-stale full-width value uses the same `480px` rule.
- Terminal-only sizing, file-tree sizing, the internal review sidebar, mobile layout, and generic `ResizeHandle` behavior remain unchanged.

## Implementation

Add a focused width calculation that converts the desired `480px` review width into a valid session width using the current measured row width and the existing `450px` session minimum.

Centralize review opening in the session page. The open operation first writes the calculated session width, then opens review state. Route the header toggle and other session-page review opening paths through this operation so every closed-to-open transition follows the same rule. Closing review does not need to persist a default session width because the next open recalculates it from the current row.

## Verification

- Unit tests cover a `1440px` desktop row, smaller desktop rows, and the `450px` session minimum.
- A Playwright regression preloads a stale full-width session value, clicks the review toggle, and verifies a visible `480px` pane.
- The regression closes and reopens review after a custom resize, verifies `480px` again, reloads, and verifies the persisted reopened layout remains visible.
- Run focused tests, app type checking, the full review-state regression file, and the production review benchmark before and after the change.
