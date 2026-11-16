import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { useI18n } from "@opencode/ui/context/i18n"
import { Menu } from "@opencode/ui/menu"
import { parsePathLineSuffix } from "@opencode/util/path"
import type { MarkdownContextMenuHandlers } from "../context/markdown"

type Target = { kind: "link"; value: string; url: string } | { kind: "path"; value: string }

type Selection = {
  target: Target
  actions: MarkdownContextMenuHandlers
  element: HTMLElement
  x: number
  y: number
  keyboard: boolean
}

const dismissEvent = "opencode:markdown-context-menu:dismiss"

export function MarkdownContextMenu(props: { root: HTMLDivElement | undefined; actions: MarkdownContextMenuHandlers }) {
  const [selection, setSelection] = createSignal<Selection>()
  const close = () => setSelection(undefined)

  createEffect(() => {
    const root = props.root
    // A mounted Markdown can follow a different session after its previous menu opened.
    const actions = props.actions
    if (!root) return

    const open = (event: MouseEvent | KeyboardEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      const element = event.target.closest("a, :not(pre) > code[data-inline-code-kind='path']")
      if (!(element instanceof HTMLElement) || !root.contains(element)) return
      const target = menuTarget(element)
      if (!target) return

      event.preventDefault()
      event.stopPropagation()
      document.dispatchEvent(new Event(dismissEvent))

      const keyboard = event instanceof KeyboardEvent
      const bounds = keyboard ? element.getBoundingClientRect() : undefined
      setSelection({
        target,
        actions,
        element,
        x: bounds?.left ?? (event instanceof MouseEvent ? event.clientX : 0),
        y: bounds?.bottom ?? (event instanceof MouseEvent ? event.clientY : 0),
        keyboard,
      })
    }

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) open(event)
    }

    root.addEventListener("contextmenu", open)
    root.addEventListener("keydown", keydown)
    onCleanup(() => {
      root.removeEventListener("contextmenu", open)
      root.removeEventListener("keydown", keydown)
      close()
    })
  })

  return (
    <Show when={selection()} keyed>
      {(selected) => <LinkMenu selected={selected} close={close} />}
    </Show>
  )
}

function LinkMenu(props: { selected: Selection; close(): void }) {
  const i18n = useI18n()
  const target = props.selected.target
  const actions = props.selected.actions
  const items = [
    {
      label: target.kind === "path" ? "ui.markdown.contextMenu.copyPath" : "ui.markdown.contextMenu.copyLink",
      run: () => actions.copy(target.value),
    },
    ...(target.kind === "link" && actions.openExternal
      ? [{ label: "ui.markdown.contextMenu.openLink", run: () => actions.openExternal?.(target.url) }]
      : []),
    ...(target.kind === "path" && actions.openPath
      ? [{ label: "ui.markdown.contextMenu.openPath", run: () => actions.openPath?.(target.value) }]
      : []),
    ...(target.kind === "path" && actions.revealPath
      ? [{ label: "ui.markdown.contextMenu.revealPath", run: () => actions.revealPath?.(target.value) }]
      : []),
  ]
  let outside = false

  document.addEventListener(dismissEvent, props.close)
  document.addEventListener("contextmenu", props.close, true)
  window.addEventListener("blur", props.close)
  onCleanup(() => {
    document.removeEventListener(dismissEvent, props.close)
    document.removeEventListener("contextmenu", props.close, true)
    window.removeEventListener("blur", props.close)
  })

  return (
    <Menu
      open
      modal={false}
      placement="bottom-start"
      gutter={0}
      onOpenChange={(open) => {
        if (!open) props.close()
      }}
    >
      <Menu.Trigger
        as="span"
        aria-hidden="true"
        tabIndex={-1}
        class="pointer-events-none fixed size-px"
        style={{ left: `${props.selected.x}px`, top: `${props.selected.y}px` }}
      />
      <Menu.Portal>
        <Menu.Content
          data-slot="markdown-context-menu"
          onInteractOutside={() => (outside = true)}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!outside && props.selected.keyboard) props.selected.element.focus({ preventScroll: true })
          }}
        >
          <For each={items}>
            {(item) => (
              <Menu.Item
                onSelect={() =>
                  void Promise.resolve()
                    .then(item.run)
                    .catch(() => undefined)
                }
              >
                {i18n.t(item.label)}
              </Menu.Item>
            )}
          </For>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  )
}

function menuTarget(element: HTMLElement): Target | undefined {
  const path = element instanceof HTMLAnchorElement ? element.dataset.localLink : element.textContent?.trim()

  if (path) {
    const value = parsePathLineSuffix(path).path
    if (value) return { kind: "path", value }
    return
  }

  if (!(element instanceof HTMLAnchorElement)) return
  const value = element.getAttribute("href")?.trim()
  if (!value) return
  const url = value.startsWith("//") ? `https:${value}` : value
  if (!URL.canParse(url)) return
  if (!["http:", "https:", "mailto:"].includes(new URL(url).protocol)) return
  return { kind: "link", value, url }
}
