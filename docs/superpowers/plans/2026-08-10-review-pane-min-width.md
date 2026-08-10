# Review Pane Minimum Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the unified review pane minimum width from 360px to 280px and produce a verified Windows x64 production installer.

**Architecture:** Keep the existing fixed-minimum width calculation and change only the unified review pane constant. Preserve the split diff and chat panel minimums, then rebuild the existing Electron/NSIS release pipeline without native dependency recompilation.

**Tech Stack:** TypeScript, SolidJS, Bun test, Electron Vite, electron-builder, NSIS

## Global Constraints

- Unified review pane minimum: 280px.
- Split diff minimum: 640px.
- Session chat panel minimum: 450px.
- Do not add settings, persisted-state migrations, or new resize behavior.
- Windows installer channel: `prod`.
- Windows installer version: `1.18.15`.
- Windows installer architecture: `x64`.

---

### Task 1: Reduce The Unified Review Pane Minimum

**Files:**
- Modify: `packages/app/src/pages/session/session-panel-width.ts:6`
- Test: `packages/app/src/pages/session/session-panel-width.test.ts:11-19`

**Interfaces:**
- Consumes: `sessionPanelWidthMax(input: { available: number; split: boolean }): number`
- Produces: `REVIEW_PANE_WIDTH_MIN = 280` while preserving `REVIEW_PANE_WIDTH_MIN_SPLIT = 640` and `SESSION_PANEL_WIDTH_MIN = 450`

- [ ] **Step 1: Write the failing test**

Change the unified minimum assertion to:

```ts
test("reserves the unified review pane minimum", () => {
  expect(REVIEW_PANE_WIDTH_MIN).toBe(280)
  expect(sessionPanelWidthMax({ available: 1700, split: false })).toBe(1700 - REVIEW_PANE_WIDTH_MIN)
})
```

Leave the split assertion at `640`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run from `packages/app`:

```powershell
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-panel-width.test.ts
```

Expected: FAIL because `REVIEW_PANE_WIDTH_MIN` is still `360`.

- [ ] **Step 3: Write the minimal implementation**

Change only the unified constant:

```ts
export const SESSION_PANEL_WIDTH_MIN = 450
export const REVIEW_PANE_WIDTH_MIN = 280
export const REVIEW_PANE_WIDTH_MIN_SPLIT = 640
```

- [ ] **Step 4: Run focused and complete verification**

Run from `packages/app`:

```powershell
bun test --conditions=solid --preload ./happydom.ts ./src/pages/session/session-panel-width.test.ts
bun run test
bun typecheck
```

Expected: focused test, all app unit/browser tests, and app typecheck pass.

- [ ] **Step 5: Commit the implementation**

```powershell
git add packages/app/src/pages/session/session-panel-width.ts packages/app/src/pages/session/session-panel-width.test.ts
git commit -m "fix(app): 缩小右侧审查栏最小宽度"
```

### Task 2: Build And Verify The Windows Release Installer

**Files:**
- Generated: `packages/desktop/dist/opencode-desktop-win-x64.exe`
- Generated: `packages/desktop/dist/opencode-desktop-win-x64.exe.blockmap`
- Generated: `packages/desktop/dist/win-unpacked/OpenCode.exe`

**Interfaces:**
- Consumes: app source at the committed Task 1 revision
- Produces: unsigned Windows x64 NSIS installer for `OpenCode` version `1.18.15`

- [ ] **Step 1: Verify desktop configuration and types**

Run from `packages/desktop`:

```powershell
bun test electron-builder.config.test.ts
bun typecheck
```

Expected: configuration tests confirm production identity `ai.opencode.desktop` / `OpenCode`, and typecheck passes.

- [ ] **Step 2: Build the production desktop bundle**

Run from `packages/desktop`:

```powershell
$env:OPENCODE_CHANNEL = "prod"
$env:OPENCODE_VERSION = "1.18.15"
$env:MODELS_DEV_API_JSON = "$HOME\.cache\opencode\models.json"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
bun run build
```

Expected: Electron Vite writes the production bundle to `packages/desktop/out`.

- [ ] **Step 3: Generate the NSIS installer**

Run from `packages/desktop` in the same environment:

```powershell
bunx electron-builder --win --publish never --config electron-builder.config.ts --config.npmRebuild=false --config.electronDist="$env:LOCALAPPDATA\electron\Cache\0398eab6ff3b10eeeae02ced94c086c2894afe98d8b58a4a1f6e485064ac1f7f\electron-v42.3.3-win32-x64.zip"
```

Expected: `dist/opencode-desktop-win-x64.exe` exists and electron-builder reports `platform=win32`, `arch=x64`, `target=nsis`.

- [ ] **Step 4: Verify release metadata and checksum**

Run from `packages/desktop`:

```powershell
$path = Resolve-Path -LiteralPath "dist\opencode-desktop-win-x64.exe"
$item = Get-Item -LiteralPath $path
$hash = Get-FileHash -LiteralPath $path -Algorithm SHA256
$signature = Get-AuthenticodeSignature -LiteralPath $path
$item.VersionInfo.ProductName
$item.VersionInfo.ProductVersion
$item.Length
$hash.Hash
$signature.Status
```

Expected: product `OpenCode`, version `1.18.15`, non-zero size, a SHA-256 digest, and `NotSigned` for the local build.

- [ ] **Step 5: Confirm source cleanliness**

Run from the repository root:

```powershell
git status --short --branch
```

Expected: no build-generated tracked changes; the two pre-existing untracked `2026-08-07` design documents remain untouched.
