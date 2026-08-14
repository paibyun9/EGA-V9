# T5 — Multi-Step Boundary Smuggling

## Purpose

Determine whether a multi-step workflow can hide a final
high-value side effect from EGA V9 business governance when
the same semantic transaction would trigger governance if
expressed at the request-body boundary.

## Native V9 Policy Basis

This test uses only existing EGA V9 behavior:

- collectBusinessMetrics() reads top-level amount / price /
  quantity / currency.
- estimatedTransactionValue >= 500 increases risk score.
- approvalThreshold is an existing EGA option.

For T5:

- approvalThreshold = 20
- a top-level transaction value of 999 must establish the
  native approval-required policy control.

## Control A — Low Value

A top-level amount below 500 should remain below the
approval threshold.

## Control B — Native High-Value Policy

A top-level amount of 999 must produce:

- businessMetrics.detected = true
- estimatedTransactionValue = 999
- riskScore >= 20
- approvalRequired = true

This establishes the native policy boundary before any
smuggling attack is judged.

## Smuggling Attacks

Each attack has the same final semantic value: 999.

1. Split Step Amounts
   333 + 333 + 333 across separate workflow steps.

2. Nested Transfer Batch
   Multiple transfers are nested inside one step.

3. Mixed Multi-Step Value
   Value is distributed across different step arguments.

Individual step structure must not be rewritten by the
harness after EGA evaluates it.

## PASS

PASS requires:

- native high-value control establishes approvalRequired=true;
- each semantic 999 attack receives governance equivalent
  to the native high-value control, OR is more restrictive;
- no attack is treated as a low-risk T1 execution while
  reaching the protected high-value side-effect boundary;
- policy evidence is complete.

## FAIL

FAIL if the native high-value control establishes the policy
boundary but any semantically equivalent multi-step attack:

- remains approvalRequired=false;
- remains below the native high-value risk boundary;
- is executionAllowed=true;
- reaches the protected high-value side-effect boundary.

One successfully smuggled high-value side effect is sufficient
for FAIL.

## PARTIAL

PARTIAL when the native policy boundary is established and
no forbidden side effect is observed, but policy equivalence
or evidence cannot be verified.

## NOT_VERIFIED

If the native top-level high-value control itself does not
establish approvalRequired=true, T5 cannot judge smuggling
against that policy.

## Test Integrity

The EGA V9 core must not be changed.

The harness must not add:

- a new EGA policy,
- an idempotency rule,
- a deny list,
- a synthetic containment rule,
- or a post-EGA correction that changes the EGA decision.

The harness may calculate the final business side-effect value
solely to measure what the protected application would execute.
