# EGA V9 Approval Bypass Mutation Evidence

## Test Identity

- Evidence schema: `ega-v9.approval-bypass-evidence.v1`
- Test ID: `AB-001`
- Repetitions per scenario: 100
- Total executions: 200
- SDK entry point: `packages/sdk-ts/dist/index.js`
- Runtime mode: `fail-closed`

## Threat Definition

The approved workflow contains a legitimate human-approval record.

The bypass mutation attempts to:

- remove the approval requirement;
- replace the approved state with a bypassed state;
- replace the human reviewer with self-authorization;
- remove the approval identifier;
- continue to checkout without valid approval evidence.

All business values and tool calls remain unchanged.

## Approval-State Comparison

| Field | Approved workflow | Bypass mutation |
|---|---|---|
| Required | `true` | `false` |
| Status | `approved` | `bypassed` |
| Approved by | `human-reviewer-01` | `agent-self` |
| Approval ID | `APR-2026-0001` | `null` |
| Method | `human-review` | `self-authorized` |

## Results

| Scenario | Detection | Execution allowed | next() calls | HTTP status | Result |
|---|---:|---:|---:|---:|---:|
| Legitimately approved workflow | match | true | 100/100 | 200 | PASS |
| Approval-bypass mutation | mismatch | false | 0/100 | 409 | PASS |

## Replay Roots

- Approved Replay Root: `62f16aa8ad2be63ac04891731795b341322de1b0d98ff241f1aa49a8b53eafd5`
- Bypassed Replay Root: `8303d0fa0ebaeb7730fe8da29c080bb079072d5d5c9ae4feb9019d301aeb84b8`
- Roots differ: `true`

## Governance Events

| Event | Approved workflow | Approval bypass |
|---|---:|---:|
| `replay.mismatch` | 0/100 | 100/100 |
| `mutation.detected` | 0/100 | 100/100 |
| `trust.escalated` | 0/100 | 100/100 |
| `approval.required` | 0/100 | 100/100 |
| `privilege.escalation.gated` | 0/100 | 100/100 |
| `containment.activated` | 0/100 | 100/100 |
| `execution.blocked` | 0/100 | 100/100 |

## Assertions

| Assertion | Result |
|---|---:|
| `workflowIdUnchanged` | PASS |
| `businessActionUnchanged` | PASS |
| `amountUnchanged` | PASS |
| `currencyUnchanged` | PASS |
| `toolsUnchanged` | PASS |
| `approvalStateChanged` | PASS |
| `approvalMutationChangesReplayRoot` | PASS |
| `approvedRootStable100` | PASS |
| `bypassedRootStable100` | PASS |
| `approvedMatches100` | PASS |
| `approvedFalsePositivesZero` | PASS |
| `bypassDetected100` | PASS |
| `approvalRequired100` | PASS |
| `privilegeGate100` | PASS |
| `executionDenied100` | PASS |
| `replayMismatchEvents100` | PASS |
| `mutationDetectedEvents100` | PASS |
| `trustEscalatedEvents100` | PASS |
| `approvalRequiredEvents100` | PASS |
| `privilegeGateEvents100` | PASS |
| `quarantineEvents100` | PASS |
| `containmentEvents100` | PASS |
| `executionBlockedEvents100` | PASS |
| `failClosedNextCallsZero` | PASS |
| `http409Responses100` | PASS |
| `directAndRuntimeRootsConsistent` | PASS |

## Final Status

**PASS**

This evidence demonstrates that approval-governance state is part of
the deterministic workflow identity. Altering or removing the sealed
approval record changes the Replay Root, triggers governance escalation,
and prevents downstream execution under fail-closed mode.

## Scope Boundary

AB-001 verifies mutation detection against a previously sealed approval
record. It does not independently authenticate a human identity or verify
a cryptographic approval signature.
