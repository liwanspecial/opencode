# Transient Retry Delay Cap

## Goal

Reduce long waits after transient provider failures while preserving provider-directed rate-limit backoff.

## Behavior

- Network failures without an HTTP status code wait at most 10 seconds before retrying.
- HTTP 5xx failures wait at most 10 seconds before retrying, including when the response supplies a longer `Retry-After` value.
- HTTP 429 responses retain the existing behavior and continue to honor `Retry-After`.
- Other retryable errors retain the existing delay behavior.
- The retry attempt count and UI countdown remain unchanged.

## Implementation

Keep the change inside `packages/opencode/src/session/retry.ts`. Calculate the delay with the existing header and exponential-backoff rules, then cap it at 10,000 milliseconds only when the API error has no status code or has a status code of 500 or greater.

Do not add a user-facing configuration field. The requested behavior is local and fixed, so a schema and configuration plumbing change would add unnecessary surface area.

## Verification

Extend `packages/opencode/test/session/retry.test.ts` to verify:

- A 503 response with `Retry-After: 120` returns 10 seconds.
- A network-style API error without a status code never exceeds 10 seconds.
- A 429 response with `Retry-After: 120` still returns 120 seconds.
- Existing retry-delay tests continue to pass.

Run the focused retry tests and package type checks, then build the Windows desktop installer. Installing the package requires the running OpenCode desktop application to exit.
