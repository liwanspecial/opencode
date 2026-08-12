import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/LegacyFilesTab"
const projectID = "proj_legacy_files_tab"
const sessionID = "ses_legacy_files_tab"
const title = "Legacy files tab"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test.use({ viewport: { width: 1440, height: 900 } })

test("opens project files from the fixed Files tab", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "legacy-files-project",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { test: { id: "test", name: "Test", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    vcsDiff: [fileDiff("src/changed.ts")],
    fileList: (path) => (path ? [] : [fileNode("README.md")]),
    fileContent: (path) => ({ type: "text", content: `contents:${path}` }),
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(
    ({ directory, server, sessionID }) => {
      const sessionKey = `local\u0000${btoa(directory)}/${sessionID}`
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: false } }))
      localStorage.setItem("app-version.v1", JSON.stringify({ version: "1.18.16" }))
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
      )
      localStorage.setItem(
        "opencode.global.dat:layout",
        JSON.stringify({
          review: { diffStyle: "split", panelOpened: true },
          sessionView: { [sessionKey]: { scroll: {}, reviewMode: "turn" } },
        }),
      )
      localStorage.setItem(
        "opencode.window.browser.dat:tabs",
        JSON.stringify([{ type: "session", server, sessionId: sessionID }]),
      )
    },
    { directory, server, sessionID },
  )

  const vcsModes: (string | null)[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname === "/vcs/diff") vcsModes.push(url.searchParams.get("mode"))
  })
  await page.goto(`/server/${base64Encode(server)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const panel = page.locator("#review-panel")
  const filesTab = panel.locator("#session-side-panel-files-tab")
  await expect(filesTab).toBeVisible()
  await filesTab.click()
  await expect(filesTab).toHaveAttribute("data-selected", "")
  await expect.poll(() => vcsModes).toContain("git")
  await panel.getByRole("button", { name: "README.md" }).click()
  await expect(panel.getByRole("tab", { name: "README.md" })).toHaveAttribute("data-selected", "")
  await expect(panel.getByText("contents:README.md", { exact: true })).toBeVisible()
  await filesTab.click()
  await expect(panel.getByRole("button", { name: "README.md" })).toBeVisible()
  await panel.locator("#session-side-panel-review-tab").click()
  await expect(panel.locator("#session-side-panel-review-tab")).toHaveAttribute("data-selected", "")
})

function fileNode(path: string) {
  return {
    name: path,
    path,
    absolute: `${directory}/${path}`,
    type: "file",
    ignored: false,
  }
}

function fileDiff(file: string) {
  return {
    file,
    before: "before\n",
    after: "after\n",
    additions: 1,
    deletions: 1,
    status: "modified",
  }
}
