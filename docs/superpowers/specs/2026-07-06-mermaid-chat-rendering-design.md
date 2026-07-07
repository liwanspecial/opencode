# Desktop Mermaid Chat Rendering Design

## Goal

Enable the Desktop app's middle chat panel to automatically render Markdown fenced code blocks tagged as `mermaid` while still allowing users to switch back to the original Mermaid source code.

## Scope

- Target the Desktop app chat panel, which reuses `packages/session-ui` message and Markdown rendering components.
- Apply only to fenced code blocks whose language is `mermaid`, case-insensitively.
- Do not change the TUI rendering path, workspace sidebar, or review panel behavior.

## Recommended Approach

Implement Mermaid handling at the `packages/session-ui` Markdown code-block rendering layer.

When a Markdown code block is identified as Mermaid, render a dedicated Mermaid component instead of the normal highlighted code block. The component defaults to diagram view and provides a small top-right toggle to switch between rendered diagram and source code.

## Behavior

- Default view: rendered Mermaid diagram.
- Toggle behavior: a button in the top-right corner switches between diagram and source code.
- Source view: preserve the existing code-block visual style where practical.
- Diagram view: render Mermaid output as SVG and allow horizontal overflow for wide diagrams.
- Error handling: if Mermaid parsing or rendering fails, show a concise error state and keep the source code accessible.

## Components And Data Flow

- Markdown parsing continues to produce code-block tokens as it does today.
- The Markdown React/Solid component checks each code block's language.
- Non-Mermaid blocks continue through the existing code rendering path.
- Mermaid blocks render through a new focused component responsible for:
  - normalizing the language match,
  - rendering Mermaid SVG,
  - managing local view state for diagram/source,
  - surfacing render errors without breaking the chat message.

## Testing

- Add or update component tests/stories covering:
  - `mermaid` language detection,
  - default diagram mode,
  - toggling to source mode,
  - render failure fallback.
- Run the relevant package checks for `packages/session-ui` and any affected Desktop build/typecheck commands available in the repository.
