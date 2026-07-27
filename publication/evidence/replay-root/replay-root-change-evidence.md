# EGA V9 Replay Root Change Evidence

## Test Identity

- Evidence schema: `ega-v9.replay-root-change-evidence.v1`
- Test ID: `RRC-001`
- SDK entry point: `packages/sdk-ts/dist/index.js`
- Hash algorithm: `SHA-256`
- Repetitions: 100

## Results

| Verification | Expected | Observed | Result |
|---|---:|---:|---:|
| Identical workflow stability | 100/100 | 100/100 | PASS |
| Reordered object-key stability | Same root | Same root | PASS |
| Tool-injection mutation sensitivity | Changed root | Changed root | PASS |
| SDK verification consistency | Root equals direct SDK root | Equal | PASS |

## Replay Roots

- Baseline: `15ee1b641de5e499d340cbacb9a172c38a0ba75734f998be8fc04bcd15d6e0a4`
- Reordered baseline: `15ee1b641de5e499d340cbacb9a172c38a0ba75734f998be8fc04bcd15d6e0a4`
- Mutated workflow: `69ccf350abb836aeba989509b97bd57fc5560b30d3d891916cb28287468dc21d`

## Mutation

An unexpected workflow step was inserted between product selection and checkout:

```json
{
  "step": 2.5,
  "action": "unknown_external_tool",
  "target": "unapproved-endpoint"
}
```

## Final Status

**PASS**

This evidence verifies only Replay Root determinism and mutation sensitivity.
It does not claim operating-system, network, VM/GPU, or model-level security coverage.
