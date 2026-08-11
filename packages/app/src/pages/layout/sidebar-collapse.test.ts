import { describe, expect, test } from "bun:test"

describe("sidebar session collapse", () => {
  test("renders an independent accessible project session toggle", async () => {
    const source = (await Bun.file(new URL("./sidebar-project.tsx", import.meta.url)).text()).replace(/\r\n/g, "\n")

    expect(source).toContain('data-action="project-sessions-toggle"')
    expect(source).toContain("aria-expanded={props.expanded()}")
    expect(source).toContain("<Show when={expanded()}>")
    expect(source).toContain('<ContextMenu.Trigger\n        as="div"')
  })

  test("uses persisted workspace state for the local workspace", async () => {
    const source = await Bun.file(new URL("./sidebar-workspace.tsx", import.meta.url)).text()
    const localWorkspace = source.slice(source.indexOf("export const LocalWorkspace"))

    expect(localWorkspace).toContain("workspaceExpanded(props.project.worktree, true)")
    expect(localWorkspace).toContain("<Collapsible")
    expect(localWorkspace).toContain("setWorkspaceExpanded(props.project.worktree, value)")
  })

  test("keeps local workspace expansion and resyncs delayed session routes", async () => {
    const source = await Bun.file(new URL("../layout.tsx", import.meta.url)).text()

    expect(source).toContain("if (sidebarStateKey(project.worktree) === sidebarStateKey(directory)) continue")
    expect(source.match(/syncSessionRoute\(dir, id, root\)/g)).toHaveLength(2)
  })
})
