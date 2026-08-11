# Review Pane Drag-to-Close Design

## Goal

Allow users to drag the divider between the session panel and the right review pane all the way to the right. At `0%` remaining review width, close the review pane immediately.

## Behavior

- Unified and split review modes have no reserved minimum width while dragging.
- The session panel may grow to the full available row width when review is open.
- Reaching the full available width immediately closes the review pane through `reviewPanel.close()`.
- Closing by drag resets the persisted session-panel width to the existing `600px` layout default.
- Reopening review from the header toggle therefore restores a visible default layout instead of reopening at zero width.
- A terminal-only right pane keeps its existing `360px` minimum width.
- File-tree sizing, review sidebar sizing, responsive breakpoints, and generic `ResizeHandle` behavior remain unchanged.

## Implementation

Keep the behavior session-specific. Update the session width helper so review mode returns the full available width as the maximum, regardless of unified or split diff style, while terminal-only mode continues reserving `360px`.

Expose a reset operation on the existing layout session-width controller so the drag handler can restore the canonical `600px` default without duplicating a magic number. In the session divider resize handler, detect the review endpoint, reset the session width, close review, and skip persisting the endpoint width.

## Verification

- Unit tests prove unified and split review modes allow the session panel to reach the full available width.
- Unit tests prove terminal-only mode still reserves `360px`.
- A focused endpoint test proves reaching `0%` requests review closure and default-width restoration.
- A Playwright regression test drags the divider to the right edge, verifies review closes, then reopens it and verifies the pane has visible non-zero width.
- Run app unit tests, browser regression coverage, type checking, and the focused production review benchmark before and after the change.
