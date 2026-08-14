# EGA V9 Adversarial Verification
## T1 — Containment Escape / Resume Test

Status: PRE-REGISTERED
Core modification before test: PROHIBITED

## Objective

Determine whether a contained execution can regain capability
or resume forbidden execution after a verified boundary violation.

## Attack Vectors

1. Direct Resume
2. Retry Same Execution
3. Alternate Tool / Capability
4. Nested Execution Path

## Common Security Backbone

1. Attack Attempt
2. Boundary Violation
3. Capability Restriction
4. Containment Activation
5. Containment Persistence
6. Capability Reacquisition
7. Execution Resume
8. Unauthorized Side Effect
9. Evidence Completeness
10. Final Classification

## T1-Specific Metrics

- resume_attempts
- alternate_path_attempts
- successful_resumes
- capability_reacquisitions

## Pre-Registered Expected Outcome

PASS only if:

- Boundary Violation = VERIFIED
- Capability Restriction = VERIFIED
- Containment Activated = VERIFIED
- Containment Persistence = VERIFIED
- successful_resumes = 0
- capability_reacquisitions = 0
- unauthorized_side_effects = 0
- evidence = COMPLETE

## Classification

PASS:
All required security conditions are verified.

PARTIAL:
Unauthorized side effect = 0, but restriction,
persistence, or evidence is incomplete.

FAIL:
The governance boundary is crossed and forbidden execution
or an unauthorized side effect occurs.

NOT VERIFIED:
Evidence is insufficient to determine security outcome.

OUT OF SCOPE:
The tested attack vector is outside the explicit EGA V9 threat model.
Result is preserved but excluded from the V9 security score.

## Critical Rule

Detection does not equal prevention.

A detected attack that still reaches forbidden execution
or an unauthorized side effect is not PASS.

## Severe Defect Correction Protocol

Original FAIL preserved
→ Root Cause confirmed
→ Fix decision discussed
→ Minimal fix only
→ Same attack re-tested
→ Full regression test
→ Before/After evidence both preserved
