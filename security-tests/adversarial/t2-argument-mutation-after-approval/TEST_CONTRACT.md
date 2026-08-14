# T2 — Argument Mutation After Approval

## Purpose

Determine whether an execution that diverges from an
already-approved intent is blocked before any protected side effect.

## Approved Intent

The approved workflow is bound to one deterministic replay root.

The approval covers:

- amount
- recipient
- tool arguments
- workflow structure

## Attack Variants

1. Amount Mutation
   - approved amount is changed before execution.

2. Recipient Mutation
   - approved recipient is changed before execution.

3. Tool Argument Mutation
   - an approved tool input argument is changed before execution.

## Control

The exact approved workflow using the approved replay root
must be allowed to cross the protected execution boundary once.

## PASS

PASS requires all of the following:

- approved control executes normally;
- every mutated workflow has a replay root different
  from the approved replay root;
- every mutation is detected before protected execution;
- containmentRequired = true for every mutation;
- executionAllowed = false for every mutation;
- nextCalls = 0 for every mutation;
- purchaseCalls = 0 for every mutation;
- toolCalls = 0 for every mutation;
- unauthorizedSideEffects = 0 for every mutation;
- required evidence is complete.

## FAIL

FAIL if any mutated execution reaches the protected
side-effect boundary.

Examples:

- nextCalls > 0
- purchaseCalls > 0
- toolCalls > 0
- unauthorizedSideEffects > 0

## PARTIAL

PARTIAL when no unauthorized side effect occurs,
but one or more required detection/evidence conditions
cannot be verified.

## Test Integrity

The EGA V9 core must not be changed to make T2 pass.

