# EGA V9 Workflow Divergence Evidence

## Test Identity

- Evidence schema: `ega-v9.workflow-divergence-evidence.v1`
- Test ID: `WD-001`
- Repetitions: 100
- SDK entry point: `packages/sdk-ts/dist/index.js`

## Results

| Verification | Expected | Observed | Result |
|---|---:|---:|---:|
| Approved workflow detection | match | match | PASS |
| Divergent workflow detection | mismatch | mismatch | PASS |
| Expected root preserved | approved root | approved root | PASS |
| Actual divergent root changed | different root | different root | PASS |
| replay.mismatch event | 1 per run | 100/100 | PASS |
| mutation.detected event | 1 per run | 100/100 | PASS |
| Normal false-positive count | 0 | 0 | PASS |

## Replay Roots

- Approved Replay Root: `a0a27096c2f5373c933c724dfacf9a5d043a296c0265a31f73aad6843aa38ab2`
- Divergent Replay Root: `ab643e8265ee45979bf9c279b921fb0f64c6ecaf0950b59f53a57b5ea13212a3`

## Inserted Divergent Step

```json
{
  "sequence": 2.5,
  "tool": "external.transfer",
  "operation": "send",
  "unauthorized": true,
  "target": "unapproved-endpoint"
}
```

## Final Status

**PASS**

This test verifies workflow-divergence detection through Replay Root comparison.
Containment effectiveness and trust-state behavior require separate tests.
