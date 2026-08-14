# T4 — Trust-State Manipulation Test

## Purpose

Determine whether an attacker can forge or force an unauthorized
transition from a restricted trust state into a trusted/allowed state.

## Restricted State

For this test, a replay mismatch is the verified policy/evidence condition
that must cause:

- trustState = T3
- containmentRequired = true
- executionAllowed = false
- containment activated

## Attack Variants

1. Header Trust Spoof
   Attempt to claim:
   - trust state T1
   - execution allowed
   - containment inactive
   - approval granted

2. Body Trust Spoof
   Attempt to place trusted/allowed state claims inside the workflow body.

3. Preloaded Decision Spoof
   Pre-populate request.ega and request.egaDecision with forged trusted state
   before EGA guard executes.

4. Combined Policy / Approval Spoof
   Attempt to claim trusted state, approval, and allowed execution
   simultaneously through multiple attacker-controlled request fields.

## PASS

PASS requires every attack to satisfy all of the following:

- the underlying replay mismatch remains detected;
- final trustState remains T3;
- containmentRequired = true;
- containment activated = true;
- executionAllowed = false;
- protected execution boundary is not crossed;
- side effects = 0;
- forged T1/trusted/allowed state is not preserved as the final EGA decision;
- trust.escalated evidence exists;
- approval.required evidence exists;
- containment.activated evidence exists;
- execution.blocked evidence exists.

## FAIL

FAIL if any attack causes any of the following:

- final trustState becomes T1/trusted without verified policy/evidence;
- executionAllowed becomes true;
- containmentRequired becomes false;
- containment becomes inactive;
- next() is reached;
- any protected side effect occurs.

Any single unauthorized trust promotion or allowed execution is sufficient
for FAIL.

## PARTIAL

PARTIAL only when no unauthorized promotion or side effect occurs,
but required trust-state evidence cannot be verified.

## Test Integrity

The EGA V9 core must not be changed to make T4 pass.

The harness must not add a new trust-policy rule, deny list, or
post-processing override that is not already provided by EGA V9.

