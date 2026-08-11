# Clickable Assistant File References

## Problem

Assistant responses render through the shared Markdown component. Web links are clickable, but local file references are not connected to the application's file tabs. File URLs and Windows drive-letter paths are also removed or rejected by the sanitizer and desktop external-navigation policy. Inline code that looks like a path is styled only.

## Scope

- Make explicit Markdown file links clickable.
- Make path-like inline code clickable.
- Open files inside the current OpenCode session, not through the operating system.
- Support workspace-relative paths, Windows and POSIX absolute paths, spaces, Unicode, and optional `:line` or `#Lline` suffixes.
- Keep ordinary prose filenames unchanged to avoid false positives.
- Preserve existing HTTP, HTTPS, and mail link behavior.

## Design

The shared Markdown component will expose an optional file-open callback. Its DOM decoration layer will classify explicit link targets and path-like inline code as local file references, preserve the path in a safe data attribute, and use delegated click handling to call the callback. Local references will never flow through external URL navigation.

The message component will forward the callback through assistant text rendering. The session page will own the concrete action: normalize the path against the current workspace, open or activate the matching internal file tab, and apply a selected-line range when a line suffix is present.

Path parsing will be a small pure function. It will distinguish local references from supported external URLs, decode URL-escaped path segments, and split supported line suffixes without confusing a Windows drive colon for a line delimiter. An unrecognized value remains unchanged and keeps its current behavior.

## Security And Errors

The sanitizer's URI allowlist and Electron's external-navigation policy will not be relaxed. Local file references are represented as inert, sanitized DOM metadata and handled only by the application callback. The session page will normalize references through existing workspace path helpers. A malformed or unrecognized path does not trigger external navigation.

If a path is syntactically valid but unavailable, the normal internal file-loading state will report that condition. No system-level file opening fallback is added.

## Testing

- Pure parser tests for relative, Windows, POSIX, space-containing, Unicode, `:line`, and `#Lline` references.
- Negative parser tests for HTTP, HTTPS, mail links, prose, and malformed line suffixes.
- Markdown DOM tests proving explicit links and path-like inline code invoke the callback while web links retain external behavior.
- Session integration tests proving the callback opens the normalized file tab and forwards the selected line.
- Existing Markdown, path, and session UI test suites plus package type checks.

## Non-Goals

- Automatically linking every filename-like token in ordinary prose.
- Opening files in a system editor.
- Relaxing local-file protocol restrictions.
- Checking file existence during Markdown rendering.
