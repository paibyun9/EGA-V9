# T7 — Core Integrity Mismatch Test

## Purpose

Determine whether an independently locked protected-core baseline
can detect a modified observed core without misclassifying it as MATCH.

## Protected Core

The test protects these files:

- packages/sdk-ts/src/index.ts
- packages/sdk-ts/test/runtime-blocking/fail-closed-runtime-blocking.test.cjs
- packages/sdk-ts/test/behavior/containment.test.mjs
- packages/sdk-ts/test/behavior/trust-state.test.mjs

## Baseline

The baseline must be generated from the current source commit
before the attack.

Each protected file must preserve:

- source-relative path
- expected SHA-256
- source commit

## Control

An unmodified copy of every protected file must produce:

- status = MATCH
- violation = false
- expected == observed
- exact source path preserved
- exact source commit preserved

## Attack

At least one protected-core file is intentionally modified in
an isolated temporary copy.

The real repository core MUST NOT be modified.

## PASS

PASS requires the intentionally modified protected file to produce:

- status = MISMATCH
- violation = true
- expected SHA-256 preserved exactly
- observed SHA-256 preserved exactly
- expected != observed
- source file path preserved exactly
- source commit preserved exactly
- baseline ID preserved
- no modified artifact classified as MATCH

## FAIL

FAIL if any intentionally modified protected core is:

- classified MATCH;
- classified VERIFIED without mismatch;
- missing Expected;
- missing Observed;
- missing Source;
- or records Expected == Observed despite file mutation.

Any single false MATCH is sufficient for FAIL.

## PARTIAL

PARTIAL if mismatch is detected but one or more provenance fields
(Expected / Observed / Source / Baseline ID) are missing or ambiguous.

## Test Integrity

This T7 harness verifies repository/core-integrity evidence.

It does NOT claim that EGA V9 already contains a production runtime
Root-of-Trust service.

The EGA V9 protected core must not be modified to make T7 pass.
