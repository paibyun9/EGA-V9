# Replay Root Determinism Validation

This evidence bundle validates the deterministic Replay Root behavior of the
EGA V9 browser demonstration.

## Implementation Under Test

The live demonstration canonicalizes workflow objects with `stableStringify`
and computes Replay Roots in the browser through the Web Crypto API:

```javascript
const buffer = await crypto.subtle.digest("SHA-256", encoded);

The validation concerns observable browser-demo behavior. It does not replace
the SDK benchmark suite or constitute a general cryptographic security proof.

Validation Results
Test	Validation	Result
Test 1	Identical steps-based workflow inputs produce identical Replay Roots	PASS
Test 2	An unauthorized DAG mutation produces a different Replay Root	PASS
Test 3	Restoring the original DAG reproduces the exact original Replay Root	PASS
Test 4	Normal and mutated DAG roots remain stable across 100 executions per state	PASS
Test 1 — Baseline

Input:

item = laptop
quantity = 1

Two executions produced the same steps-domain Replay Root:

c74d7d9846359868c58c0d3442abbf7f5a536988b236b49d38b3335a65eab82e

This test uses the steps-based workflow object.

Test 2 — DAG Mutation

Normal DAG Replay Root:

587ad42b30acbf371367e144dd195c23a8835c3f3ac9ef0e238ce8e67a507564

The mutation inserted:

{
  "id": "X",
  "action": "unauthorized_tool_call",
  "next": "C"
}

Mutated DAG Replay Root:

6fddd037a4927f2a067189790a2b699811b92a4322a4e8993e480fc77c1249c7

The demo reported replay divergence and displayed the contained/blocked state.

Test 3 — Restoration

The observed transition was:

Hash A → Hash B → Hash A

After resetting the DAG, the exact original normal DAG Replay Root was
reproduced and the mismatch state was cleared.

Test 4 — Repeatability

The browser executed 100 normal-state comparisons and 100 mutation-state
comparisons.

Normal consistency: 100/100
Mutation divergence: 100/100
Failed checks: 0

The elapsed time recorded in the JSON is an execution-log value for the local
browser session and must not be interpreted as a portable performance
benchmark.

Evidence Files
test-1-baseline.json
test-2-input-mutation.json
test-3-normal-dag-restoration.json
test-4-repeatability.json
manifest.json
Interpretation

These results demonstrate that the browser demo does not display one fixed
Replay Root for all tested states. The roots are derived from canonicalized
workflow structures, remain stable for identical inputs, change after a DAG
mutation, and return to the original value when the original DAG is restored.

Test 1 and Tests 2–4 use different input object domains. Therefore, the
steps-based Test 1 hash must not be compared directly with the DAG-domain
normal hash used by Tests 2–4.
