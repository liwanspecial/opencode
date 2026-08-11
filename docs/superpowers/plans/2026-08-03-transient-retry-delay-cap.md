# Transient Retry Delay Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap network and HTTP 5xx retry waits at 10 seconds while preserving provider-directed rate-limit delays, then produce a Windows prod release installer.

**Architecture:** Keep retry classification and delay limiting inside the existing session retry module. Preserve the current delay calculation, then apply a second cap only when an API error has no status code or has a 5xx status. Build the desktop application with `OPENCODE_CHANNEL=prod` so the package uses the production app ID and product name.

**Tech Stack:** TypeScript, Effect schedules, Bun test, Electron Vite, electron-builder/NSIS

---

### Task 1: Define retry-delay behavior with tests

**Files:**
- Modify: `packages/opencode/test/session/retry.test.ts`

- [ ] **Step 1: Extend the API error helper with a status code**

Change the helper to accept an optional status code while preserving existing calls:

```ts
function apiError(headers?: Record<string, string>, statusCode?: number): SessionV1.APIError {
  return Schema.decodeUnknownSync(SessionV1.APIError.Schema)(
    new SessionV1.APIError({
      message: "boom",
      isRetryable: true,
      statusCode,
      responseHeaders: headers,
    }).toObject(),
  )
}
```

- [ ] **Step 2: Add failing transient-cap and rate-limit-preservation tests**

Update the missing-header expectation to cap at `SessionRetry.RETRY_MAX_TRANSIENT_DELAY`, add a 503 test with a 120-second retry hint, and add a 429 test proving the same hint remains 120 seconds. Mark existing long-header tests as 429 responses so they continue testing runtime timer limits rather than transient failures.

```ts
test("caps delay at 10 seconds for network errors", () => {
  const error = apiError()
  const delays = Array.from({ length: 10 }, (_, index) => SessionRetry.delay(index + 1, error))
  expect(delays).toStrictEqual([2000, 4000, 8000, 10000, 10000, 10000, 10000, 10000, 10000, 10000])
})

test("caps retry-after at 10 seconds for 5xx errors", () => {
  const error = apiError({ "retry-after": "120" }, 503)
  expect(SessionRetry.delay(1, error)).toBe(10000)
})

test("preserves retry-after for rate limits", () => {
  const error = apiError({ "retry-after": "120" }, 429)
  expect(SessionRetry.delay(1, error)).toBe(120000)
})
```

- [ ] **Step 3: Run the focused tests and verify they fail for the new behavior**

Run from `packages/opencode`:

```powershell
bun test test/session/retry.test.ts
```

Expected: the transient 10-second assertions fail because the current implementation returns longer provider or exponential delays.

### Task 2: Implement the transient retry cap

**Files:**
- Modify: `packages/opencode/src/session/retry.ts`
- Test: `packages/opencode/test/session/retry.test.ts`

- [ ] **Step 1: Add the transient delay constant and conditional cap**

Add `RETRY_MAX_TRANSIENT_DELAY` and let the existing runtime cap apply the shorter value only to status-less and 5xx API errors:

```ts
export const RETRY_MAX_TRANSIENT_DELAY = 10_000

function cap(ms: number, error?: SessionV1.APIError) {
  const delay = Math.min(ms, RETRY_MAX_DELAY)
  const status = error?.data.statusCode
  const transient = error && (status === undefined || (status >= 500 && status < 600))
  return transient ? Math.min(delay, RETRY_MAX_TRANSIENT_DELAY) : delay
}
```

Pass `error` to every `cap(...)` call inside `delay(...)`, including retry-header, exponential-header, and no-header branches.

- [ ] **Step 2: Run the focused retry tests**

Run:

```powershell
bun test test/session/retry.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run package type checking**

Run:

```powershell
bun run typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Inspect the scoped diff**

Run:

```powershell
git diff -- packages/opencode/src/session/retry.ts packages/opencode/test/session/retry.test.ts
```

Expected: only the transient cap and its tests are present.

### Task 3: Build and verify the Windows prod release installer

**Files:**
- Generated: `packages/desktop/dist/opencode-desktop-win-x64.exe`
- Generated: `packages/desktop/dist/win-unpacked/OpenCode.exe`

- [ ] **Step 1: Build the production desktop bundle**

Run from the repository root in one PowerShell process so the channel applies to both commands:

```powershell
$env:OPENCODE_CHANNEL = "prod"
$env:OPENCODE_VERSION = "1.18.11"
$env:MODELS_DEV_API_JSON = "$HOME\.cache\opencode\models.json"
bun run --cwd packages/desktop build
Push-Location packages/desktop
bunx electron-builder --win --config electron-builder.config.ts --config.npmRebuild=false `
  --config.electronDist="$env:LOCALAPPDATA\electron\Cache\0398eab6ff3b10eeeae02ced94c086c2894afe98d8b58a4a1f6e485064ac1f7f\electron-v42.3.3-win32-x64.zip"
Pop-Location
```

Expected: Electron Vite performs a production build and electron-builder creates an NSIS installer under `packages/desktop/dist`.

- [ ] **Step 2: Verify release identity**

Run `bun test electron-builder.config.test.ts` from `packages/desktop` and confirm the prod case uses:

```yaml
appId: ai.opencode.desktop
productName: OpenCode
```

Reject the build if it contains `ai.opencode.desktop.dev` or `OpenCode Dev`.

- [ ] **Step 3: Verify installer artifact and checksum**

Confirm `packages/desktop/dist/opencode-desktop-win-x64.exe` exists, report its size and release version metadata, and calculate its SHA-256 hash with `Get-FileHash`.

- [ ] **Step 4: Hand off the installer for manual installation**

Report the verified NSIS installer path. The user will close the running OpenCode desktop application and install it manually.
