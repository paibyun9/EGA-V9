# EGA V9 v1 Runtime Governance Benchmark

- Profile: `publication`
- Generated: `2026-07-13T21:59:31.796Z`
- Node.js: `v20.20.2`
- Platform: `darwin`
- CPU: `Apple M1`

| Scenario | Operations | Concurrency | Mean µs | p50 µs | p95 µs | p99 µs | Ops/sec | CPU µs/op | Evidence bytes/op | Errors | Root divergence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| normal | 1000 | 1 | 22.386403 | 20.5625 | 26.42115 | 42.00384 | 25392.875394 | 66.798 | 3672 | 0 | 0 |
| replay-mismatch | 1000 | 1 | 65.412067 | 61.6455 | 69.30865 | 89.94601 | 12380.310869 | 115.961 | 3888 | 0 | 0 |
| normal | 1000 | 10 | 243.828426 | 233.1875 | 288.6479 | 905.43458 | 30634.869061 | 56.038 | 3672 | 0 | 0 |
| replay-mismatch | 1000 | 10 | 716.043354 | 687.479 | 793.20595 | 1450.67292 | 12589.113931 | 104.084 | 3888 | 0 | 0 |
| normal | 1000 | 50 | 1304.299797 | 1257.2295 | 1870.4771 | 2026.93916 | 30110.090319 | 58.922 | 3672 | 0 | 0 |
| replay-mismatch | 1000 | 50 | 3588.504358 | 3495.625 | 4285.7271 | 4514.5825 | 12559.355987 | 105.93 | 3888 | 0 | 0 |
| normal | 10000 | 1 | 17.702174 | 15.583 | 20.042 | 27.12584 | 31465.109946 | 38.9235 | 3672 | 0 | 0 |
| replay-mismatch | 10000 | 1 | 63.196441 | 59.666 | 65.125 | 79.17283 | 12902.626459 | 88.0853 | 3888 | 0 | 0 |
| normal | 10000 | 10 | 223.432344 | 209.458 | 257.33605 | 850.7525 | 33899.114182 | 35.0386 | 3672 | 0 | 0 |
| replay-mismatch | 10000 | 10 | 692.968682 | 660.2915 | 760.82295 | 1435.33525 | 13059.61256 | 87.5075 | 3888 | 0 | 0 |
| normal | 10000 | 50 | 1154.242715 | 1089.125 | 1792.56395 | 1970.88125 | 33545.832203 | 36.9959 | 3672 | 0 | 0 |
| replay-mismatch | 10000 | 50 | 3473.73907 | 3344.625 | 4309.4191 | 4800.96325 | 13017.578939 | 89.3581 | 3888 | 0 | 0 |

## Interpretation Boundaries

- These values measure the local EGA runtime-governance path.
- They do not include foundation-model inference.
- The benchmark harness initiates zero LLM calls.
- Smoke-profile results are diagnostic and must not be cited.
- Publication-profile results remain candidate evidence until repeated-run review and benchmark-gate approval.
