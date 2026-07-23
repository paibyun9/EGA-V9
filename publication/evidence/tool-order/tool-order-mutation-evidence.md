# EGA V9 Tool Order Mutation Evidence

## Test Identity

- Evidence schema: `ega-v9.tool-order-mutation-evidence.v1`
- Test ID: `TO-001`
- Repetitions per scenario: 100
- Total executions: 200
- SDK entry point: `packages/sdk-ts/dist/index.js`
- Runtime mode: `observe`

## Mutation Definition

The approved and reordered workflows contain the same tools and
the same tool count. Only the invocation order is changed.

### Approved Order

`catalog.search → catalog.select → commerce.checkout`

### Reordered Execution

`catalog.select → catalog.search → commerce.checkout`

## Results

| Scenario | Detection | Stable root | Match count | Mismatch count | Result |
|---|---:|---:|---:|---:|---:|
| Approved tool order | match | true | 100/100 | 0/100 | PASS |
| Reordered tools | mismatch | true | 0/100 | 100/100 | PASS |

## Replay Roots

- Approved Replay Root: `1b7199c563c3c6444341887fd2aecf64bd3eb642d8c2d8ab4fee10ade202efb0`
- Reordered Replay Root: `f549947939289283bc6286fe82a5d143f69385b84cfbdca3aff4896f815f9d82`
- Roots differ: `true`

## Governance Events

| Event | Approved order | Reordered tools |
|---|---:|---:|
| `replay.mismatch` | 0/100 | 100/100 |
| `mutation.detected` | 0/100 | 100/100 |
| `execution.blocked` | 0/100 | 0/100 |

## Assertions

| Assertion | Result |
|---|---:|
| `sameToolCount` | PASS |
| `sameToolSet` | PASS |
| `orderActuallyChanged` | PASS |
| `toolOrderChangesReplayRoot` | PASS |
| `approvedRootStable100` | PASS |
| `reorderedRootStable100` | PASS |
| `approvedMatches100` | PASS |
| `approvedFalsePositivesZero` | PASS |
| `reorderedMismatchDetected100` | PASS |
| `replayMismatchEvents100` | PASS |
| `mutationDetectedEvents100` | PASS |
| `directAndRuntimeRootsConsistent` | PASS |
| `observeModeDoesNotBlock` | PASS |

## Final Status

**PASS**

This evidence verifies that changing only tool invocation order
changes the Replay Root and is detected as a deterministic workflow
mismatch.

Fail-closed execution blocking is evaluated separately by FC-001.
