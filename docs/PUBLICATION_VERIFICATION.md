# Publication Verification

EGA V9 uses staged release gates to keep the runtime, SDK, benchmark evidence, paper artifacts, and public documentation aligned.

## Stage A — Release Foundation

```bash
npm run release:gate
Stage B — Engine Verification
npm run stage-b:gate
Stage C — Benchmark Verification
npm run stage-c:gate
Stage D — Table 4 Consistency
npm run stage-d:gate
Stage E — Public Artifact Consistency
npm run stage-e:gate
Complete Verification
npm run release:all-gates
Live URL Verification
npm run stage-e:live

The canonical release configuration is defined in:

publication/manifest.json

