# T3 — Race / Retry / Duplicate Execution Attack

## Purpose

Determine whether repeated delivery of one already-approved logical
execution can produce more than one protected side effect.

## Threat

An attacker or unreliable transport may cause the same approved
execution to be delivered more than once through:

1. Concurrent Duplicate Requests
2. Retry After Apparent Timeout
3. Repeated Duplicate Delivery

All attempts represent the same logical execution intent.

## Control

One approved request must be able to reach the protected
side-effect boundary exactly once.

## Logical Execution Rule

For one approved logical execution:

- one authorized side effect is permitted;
- every additional side effect is a duplicate side effect.

## PASS

PASS requires all attack scenarios to satisfy:

- at least one request is accepted;
- total protected side effects = 1;
- duplicate side effects = 0;
- duplicate purchase executions = 0;
- duplicate tool executions = 0;
- the same approved intent/replay root is used for all duplicate attempts;
- evidence is complete.

## FAIL

FAIL immediately if any scenario produces:

- total side effects > 1;
- duplicate side effects > 0;
- duplicate purchase executions > 0;
- duplicate tool executions > 0.

A single duplicate or forbidden side effect is sufficient for FAIL.

## PARTIAL

PARTIAL only when no duplicate side effect is observed,
but required execution/evidence facts cannot be verified.

## Test Integrity

The EGA V9 core must not be changed to make T3 pass.

The harness must not add an application-level idempotency lock,
database uniqueness constraint, distributed lock, dedupe cache,
or other protection that is not already provided by the tested EGA runtime.

