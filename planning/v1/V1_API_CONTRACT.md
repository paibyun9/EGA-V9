# EGA V9 v1.0 Public API Contract

Status: Proposed and frozen for implementation after contract approval.

This document defines the intended public API for EGA V9 v1.0.0.

It does not claim that every listed API is already implemented.

## 1. Compatibility Policy

EGA V9 v1.0.0 will preserve the following existing public APIs:

- `EGA`
- `verifyExecution`
- `replay`
- `provenance`
- `contain`

These APIs must not be removed or silently renamed in v1.0.0.

## 2. New High-Level API

EGA V9 v1.0.0 will add:

- `ega`
- `ega.guard()`

Canonical import:

```ts
import { ega } from "ega-v9";

Canonical middleware usage:

app.use(ega.guard());
3. Responsibility of ega.guard()

ega.guard() is an execution-governance middleware.

It must:

obtain a governable workflow from the request or a configured resolver;
run EGA execution verification;
attach governance evidence to the request and response context;
call next() when execution is allowed;
block the request when fail-closed containment is required;
return a deterministic, machine-readable containment response;
expose measured verification latency;
make no external LLM call in the verification path; and
fail closed when configured workflow resolution or verification fails.

It must not claim to replace:

authentication;
authorization;
network security;
model safety;
input validation;
infrastructure security; or
application-specific business policy.
4. Default Middleware Behavior

Default containment mode:

fail-closed

Default success behavior:

verification succeeds
→ governance evidence is attached
→ next() is called

Default failure behavior:

verification fails or divergence is detected
→ containmentRequired = true
→ request is blocked
→ next() is not called

Default blocked HTTP status:

403

Internal middleware failures may use:

500

Only when the failure cannot be represented as a normal governance containment decision.

5. Workflow Resolution

The middleware must support a configurable workflow resolver.

Proposed contract:

type EGAWorkflowResolver = (
  req: EGARequestLike
) => unknown | Promise<unknown>;

Default resolution order:

req.egaWorkflow
req.body.workflow
req.body
configured resolver

The final implementation must document the exact order and test it.

6. Guard Options

Proposed public contract:

export type EGAGuardOptions = {
  mode?: "observe" | "fail-closed";
  statusCode?: number;
  resolveWorkflow?: EGAWorkflowResolver;
  onVerified?: (result: EGAGuardDecision) => void | Promise<void>;
  onContained?: (result: EGAGuardDecision) => void | Promise<void>;
};

Default values:

mode = "fail-closed"
statusCode = 403
7. Guard Decision

Proposed public result:

export type EGAGuardDecision = {
  verified: boolean;
  containmentRequired: boolean;
  executionAllowed: boolean;
  trustState: string;
  reason: string | null;
  latencyMicroseconds: number;
  verification: EGARequestContext;
};

latencyMicroseconds must be numeric, not a formatted string.

README examples may format the value for display, but the SDK result must remain machine-readable.

8. Request Context

After successful middleware execution, governance evidence should be available as:

req.ega

Proposed request context:

export type EGARequestGovernanceContext = {
  decision: EGAGuardDecision;
};

Express-specific type augmentation may be provided separately.

9. Framework Dependency Policy

The core SDK must not require Express at runtime solely to define the middleware contract.

ega.guard() should use structural request, response, and next-function types compatible with Express-style middleware.

Express may be used as a development and integration-test dependency.

10. Export Contract

The v1.0 public surface must include:

export class EGA;
export function verifyExecution(...);
export function replay(...);
export function provenance(...);
export function contain(...);
export const ega;

The ega facade must expose:

ega.guard(options?)
11. Truthfulness Rule

README, npm documentation, Demo output, benchmark claims, and paper claims may reference ega.guard() only after:

implementation is complete;
TypeScript build passes;
behavioral tests pass;
Express integration tests pass;
fail-closed behavior is verified;
latency is measured from raw benchmark output; and
Stage A-E consistency checks pass.

No unverified latency, cost, safety, false-positive, or false-negative value may be published.

12. Versioning Rule

The package version must remain 0.1.0 during implementation.

Version changes to 1.0.0-rc.1 or 1.0.0 occur only after implementation, testing, benchmark regeneration, and release-gate approval.
