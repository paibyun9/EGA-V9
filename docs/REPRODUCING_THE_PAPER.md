# Reproducing the EGA V9 Paper

This guide explains how to reproduce the benchmark and publication workflow used by the EGA V9 paper.

## 1. Clone the Repository

```bash
git clone https://github.com/paibyun9/EGA-V9.git
cd EGA-V9
2. Install Dependencies
npm ci
3. Build the SDK
npm run build
4. Run Tests
npm test
5. Verify the Benchmark
npm run stage-c:gate
6. Regenerate Table 4
npm run table4:build

Generated publication artifacts:

paper/generated/
7. Verify Table 4
npm run stage-d:gate
8. Run All Release Gates
npm run release:all-gates

Deterministic correctness results should remain stable.

Performance measurements may vary across hardware and runtime environments.
