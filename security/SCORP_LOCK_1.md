# SCORP LOCK #1

SCORP LOCK #1 defines the first V9 runtime safety principle:

> Execution governance must fail closed when replay integrity, provenance continuity, or containment state cannot be verified.

## Scope

SCORP LOCK #1 applies to:

- replay-root generation
- provenance reconstruction
- containment activation
- malformed workflow inputs
- unsafe execution state transitions

## Default Rule

If verification is incomplete, ambiguous, or inconsistent:

```text
allow = false
status = contained
trust_level = supported
Public Claim Boundary

EGA V9 governs execution-layer failures.

EGA V9 does not claim to prevent all hacking.
