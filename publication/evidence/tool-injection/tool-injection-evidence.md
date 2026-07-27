# EGA V9 Workflow-Level Tool Injection Evidence

## Test Identity

- Evidence schema: `ega-v9.workflow-tool-injection-evidence.v1`
- Test ID: `TI-001`
- Repetitions per scenario: 100
- Total executions: 200
- SDK entry point: `packages/sdk-ts/dist/index.js`
- Runtime mode: `fail-closed`

## Threat Definition

The attack preserves the approved workflow ID, business action,
amount, currency, and all originally approved tools.

It injects one additional unapproved Tool into the workflow before
the approved checkout operation.

## Approved Tool Sequence

`catalog.search → catalog.select → commerce.checkout`

## Injected Tool Sequence

`catalog.search → catalog.select → external.funds.transfer → commerce.checkout`

## Injected Tool

- Name: `external.funds.transfer`
- Destination: `UNAPPROVED-DESTINATION`
- Authorization: `agent-self`

## Results

| Scenario | Detection | Execution allowed | next() calls | HTTP status | Result |
|---|---:|---:|---:|---:|---:|
| Approved workflow | match | true | 100/100 | 200 | PASS |
| Tool-injected workflow | mismatch | false | 0/100 | 409 | PASS |

## Replay Roots

- Approved Replay Root: `a2c6c39b405c02ce1e049aeadf0ad8b1cf4e620483bca200db984a0df8a00d87`
- Injected Replay Root: `83f5650527dd438a66b994599fee2773edde035bbae3d573b28aaff1c46f98b7`
- Roots differ: `true`

## Governance Events

| Event | Approved workflow | Injected workflow |
|---|---:|---:|
| `replay.mismatch` | 0/100 | 100/100 |
| `mutation.detected` | 0/100 | 100/100 |
| `trust.escalated` | 0/100 | 100/100 |
| `approval.required` | 0/100 | 100/100 |
| `privilege.escalation.gated` | 0/100 | 100/100 |
| `quarantine.created` | 0/100 | 100/100 |
| `containment.activated` | 0/100 | 100/100 |
| `execution.blocked` | 0/100 | 100/100 |

## Assertions

| Assertion | Result |
|---|---:|
| `workflowIdUnchanged` | PASS |
| `businessActionUnchanged` | PASS |
| `amountUnchanged` | PASS |
| `currencyUnchanged` | PASS |
| `exactlyOneToolInjected` | PASS |
| `originalApprovedToolsPreserved` | PASS |
| `injectedToolPresentOnce` | PASS |
| `toolInjectionChangesReplayRoot` | PASS |
| `approvedRootStable100` | PASS |
| `injectedRootStable100` | PASS |
| `approvedMatches100` | PASS |
| `approvedFalsePositivesZero` | PASS |
| `toolInjectionDetected100` | PASS |
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

TI-001 demonstrates that inserting one unapproved Tool into an
otherwise unchanged approved workflow changes the deterministic
Replay Root and prevents downstream execution under fail-closed mode.

## Scope Boundary

This evidence tests Tool insertion at the workflow-data and runtime
governance level. It does not test prompt-injection detection inside
a language model, model-weight compromise, or operating-system
compromise.
