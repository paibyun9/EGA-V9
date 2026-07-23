# EGA V9 Trust State Escalation Evidence

## Test Identity

- Evidence schema: `ega-v9.trust-state-escalation-evidence.v1`
- Test ID: `TS-001`
- Repetitions per scenario: 100
- Total executions: 300
- SDK entry point: `packages/sdk-ts/dist/index.js`
- Approval threshold: 70

## Results

| Scenario | Detection | Risk score | Trust tier | Approval | Privilege gate | Result |
|---|---:|---:|---:|---:|---:|---:|
| Normal approved workflow | match | 10 | T1 | false | false | PASS |
| Replay Root mismatch | mismatch | 85 | T3 | true | true | PASS |
| High-value Replay Root mismatch | mismatch | 95 | T4 | true | true | PASS |

## Expected Trust Transitions

- Normal execution: `T1 → T1`
- Standard mismatch: `T1 → T3`
- High-value mismatch: `T1 → T4`

## Event Results

| Event | Normal | Standard mismatch | High-value mismatch |
|---|---:|---:|---:|
| `trust.evaluated` | 100/100 | 100/100 | 100/100 |
| `trust.escalated` | 0/100 | 100/100 | 100/100 |
| `approval.required` | 0/100 | 100/100 | 100/100 |
| `privilege.escalation.gated` | 0/100 | 100/100 | 100/100 |

## Replay Roots

- Approved normal root: `30fdcfe81ec807167d309eb9e4d59891269dce83748200db781e64d97e0c1c11`
- Approved high-value root: `221c48e9684aa624f6b92a217046f0a4ec8c6c30f71d532b97e68189f028919b`
- Standard mismatch actual root: `a10f6f35428836284c6793925576b5340abf76726a23eb272ada98d708097923`
- High-value mismatch actual root: `1ed06b434271f5bf5d1b643e3ed66055d7ef9a8fd41adedc9ff904c16973125d`

## Assertions

| Assertion | Result |
|---|---:|
| `normalRemainsT1` | PASS |
| `standardMismatchEscalatesT1ToT3` | PASS |
| `highValueMismatchEscalatesT1ToT4` | PASS |
| `normalHasNoTrustEscalation` | PASS |
| `normalHasNoApprovalRequirement` | PASS |
| `normalHasNoPrivilegeGate` | PASS |
| `standardMismatchTrustEvaluated` | PASS |
| `standardMismatchTrustEscalated` | PASS |
| `standardMismatchApprovalRequired` | PASS |
| `standardMismatchPrivilegeGate` | PASS |
| `highValueMismatchTrustEvaluated` | PASS |
| `highValueMismatchTrustEscalated` | PASS |
| `highValueMismatchApprovalRequired` | PASS |
| `highValueMismatchPrivilegeGate` | PASS |
| `standardTransitionDetailsCorrect` | PASS |
| `highValueTransitionDetailsCorrect` | PASS |

## Final Status

**PASS**

This evidence verifies deterministic trust-state evaluation and escalation
for normal, Replay Root mismatch, and high-value mismatch scenarios.

Containment blocking behavior is evaluated separately.
