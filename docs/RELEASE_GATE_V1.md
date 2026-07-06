# EGA V9 v1.0.0 Release Gate

EGA V9 must not be released as v1.0.0 until all gates pass.

## Required Gates

- [ ] GitHub source code is clean and public.
- [ ] npm package exposes the documented public API.
- [ ] Replay consistency is implemented by real deterministic computation.
- [ ] DAG divergence detection is implemented.
- [ ] Trust state evaluation is implemented.
- [ ] Fail-closed containment is implemented.
- [ ] Demo behavior matches the SDK behavior.
- [ ] Benchmark results are reproducible from public code.
- [ ] No build artifacts are committed.
- [ ] No secrets or private keys are committed.
- [ ] README describes only implemented behavior.
- [ ] Version is ready for v1.0.0 release.

## Scorp Lock Rule

Preprint submission is blocked until this Release Gate passes.
