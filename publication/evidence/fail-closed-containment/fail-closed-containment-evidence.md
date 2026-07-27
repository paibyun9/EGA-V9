# EGA V9 Fail-Closed Containment Evidence

## Test Identity

- Evidence schema: `ega-v9.fail-closed-containment-evidence.v1`
- Test ID: `FC-001`
- Repetitions per scenario: 100
- Total executions: 300
- SDK entry point: `packages/sdk-ts/dist/index.js`

## Results

| Scenario | Detection | Mode | Containment | Execution allowed | next() | HTTP | Result |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normal fail-closed | match | fail-closed | false | true | true | 200 | PASS |
| Mismatch fail-closed | mismatch | fail-closed | true | false | false | 409 | PASS |
| Mismatch observe | mismatch | observe | true | true | true | 200 | PASS |

## Containment Event Results

| Event | Normal fail-closed | Mismatch fail-closed | Mismatch observe |
|---|---:|---:|---:|
| `replay.mismatch` | 0/100 | 100/100 | 100/100 |
| `quarantine.created` | 0/100 | 100/100 | 100/100 |
| `containment.activated` | 0/100 | 100/100 | 100/100 |
| `execution.blocked` | 0/100 | 100/100 | 0/100 |

## Replay Roots

- Approved Replay Root: `a38d155d1195237432d3a97ce6765ed39c670eb525181e4116349897bd60b864`
- Fail-closed mismatch Replay Root: `a53bc4276fb082cff683659f2dd5ee2f825046b8cdd424e7f4f8a2b0cc48fbc9`
- Observe mismatch Replay Root: `a53bc4276fb082cff683659f2dd5ee2f825046b8cdd424e7f4f8a2b0cc48fbc9`

## Fail-Closed Response

- HTTP status: `409`
- Error code: `EGA_CONTAINMENT_ACTIVATED`
- Containment mode: `fail-closed`
- Execution allowed: `false`
- next() called: `false`

## Assertions

| Assertion | Result |
|---|---:|
| `normalExecutionAllowed` | PASS |
| `normalDoesNotActivateContainment` | PASS |
| `normalDoesNotRecordBlockedEvent` | PASS |
| `failClosedMismatchDetected` | PASS |
| `failClosedContainmentActivated` | PASS |
| `failClosedExecutionDisallowed` | PASS |
| `failClosedNextNotCalled` | PASS |
| `failClosedReturns409` | PASS |
| `failClosedReturnsContainmentError` | PASS |
| `failClosedCreatesQuarantine` | PASS |
| `failClosedRecordsExecutionBlocked` | PASS |
| `observeMismatchDetected` | PASS |
| `observeExecutionAllowed` | PASS |
| `observeNextCalled` | PASS |
| `observeDoesNotRecordExecutionBlocked` | PASS |
| `containmentModeDoesNotChangeReplayRoot` | PASS |

## Final Status

**PASS**

This evidence verifies that Replay Root mismatch activates
containment in both fail-closed and observe modes, while only
fail-closed mode prevents downstream execution and records an
`execution.blocked` event.

Remote infrastructure, operating-system, network, and model-level
containment are outside the scope of this test.
