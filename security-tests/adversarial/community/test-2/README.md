# EGA V9 Community Adversarial Test — Test 2

**Proof before explanation.**

A community question raised a concrete boundary issue:

> Runtime governance may enforce invariants through checks, but what guarantees the integrity of the runtime state that the governance layer itself trusts?

This README turns that question into an executable test against the published EGA V9 package.

No EGA V9 core code is modified.

**Don't trust our conclusion. Copy the test. Run it. Observe the result yourself.**

---

## Your Question

The underlying question is:

> **Can governance-relevant runtime state used by EGA V9 be directly mutated outside the governance check, and can that mutation change the execution decision?**

This test does not attempt to prove anything about operating-system compromise, arbitrary memory corruption, remote attackers, hardware security, or language-level memory safety.

It tests one narrower question against the published JavaScript package.

---

## How We Translated It

Inspection of the published `ega-v9@1.0.3` package showed that an EGA instance contains an `options` object with governance-relevant runtime values including:

```text
trustLevel
failClosed
policyId
approvalThreshold
```

The published guard implementation reads `this.options.failClosed` during execution and uses it when determining whether a detected replay-root mismatch may continue.

The relevant decision path includes:

```text
this.options.failClosed
        ↓
replay-root mismatch detected
        ↓
containment mode
        ↓
executionAllowed
```

We therefore tested the following A/B condition:

```text
A — BEFORE MUTATION

failClosed = true
+
deliberate replay-root mismatch
        ↓
observe EGA decision


B — AFTER DIRECT MUTATION

same EGA instance
+
instance.options.failClosed = false
+
same deliberate replay-root mismatch
        ↓
observe EGA decision
```

The request condition remains the same.

The only intentional governance-state change between A and B is:

```javascript
ega.options.failClosed = false;
```

---

## Test Environment

Observed test environment:

```text
Node.js: v20.20.2
npm: 10.8.2
ega-v9: 1.0.3
```

EGA V9 core modification:

```text
0
```

The published package was used as installed.

---

## Copy & Run

### 1. Create a clean test directory

```bash
mkdir ega-v9-community-test-2
cd ega-v9-community-test-2
npm init -y
npm install ega-v9@1.0.3
```

If EGA V9 has not already been activated in your environment, complete the normal Evaluation License activation:

```bash
npx ega-v9 register
```

If a valid EGA V9 Evaluation License is already installed, reuse the existing activation rather than registering again.

---

### 2. Create the test

Create:

```text
state-mutation-test.cjs
```

with the following exact code:

```javascript
const { EGA } = require("ega-v9");

function makeRequest() {
  return {
    method: "POST",
    path: "/governed-action",
    url: "/governed-action",
    headers: {
      "content-type": "application/json",
      "x-ega-expected-replay-root":
        "community-test-2-deliberate-mismatch",
    },
    body: {
      action: "refund",
      amount: 125,
    },
  };
}

function makeResponse() {
  const headers = {};

  return {
    statusCode: 200,

    setHeader(name, value) {
      headers[String(name).toLowerCase()] = String(value);
    },

    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },

    send(body) {
      this.body = body;
      return this;
    },

    headers,
  };
}

function runGuard(ega, label) {
  const req = makeRequest();
  const res = makeResponse();

  let nextCalled = false;

  ega.guard()(req, res, () => {
    nextCalled = true;
  });

  console.log(`\n=== ${label} ===`);
  console.log(
    "instance.options.failClosed =",
    ega.options.failClosed
  );
  console.log(
    "detection.status =",
    req.ega?.detection?.status
  );
  console.log(
    "containment.activated =",
    req.ega?.containment?.activated
  );
  console.log(
    "containment.mode =",
    req.ega?.containment?.mode
  );
  console.log(
    "executionAllowed =",
    req.ega?.containment?.executionAllowed
  );
  console.log("nextCalled =", nextCalled);
  console.log("response.statusCode =", res.statusCode);

  return {
    detection: req.ega?.detection?.status,
    containmentActivated:
      req.ega?.containment?.activated,
    containmentMode:
      req.ega?.containment?.mode,
    executionAllowed:
      req.ega?.containment?.executionAllowed,
    nextCalled,
    statusCode: res.statusCode,
  };
}

const ega = EGA.init({
  appName: "community-test-2",
  telemetry: false,
  failClosed: true,
  trustLevel: "supported",
  policyId: "community-test-2-policy",
  approvalThreshold: 70,
});

console.log("=== COMMUNITY TEST 2 ===");
console.log("ega-v9 = 1.0.3");

console.log("\n=== INITIAL STATE ===");
console.log(
  "instance.options.failClosed =",
  ega.options.failClosed
);

const before = runGuard(
  ega,
  "A — BEFORE DIRECT MUTATION"
);

console.log("\n=== DIRECT EXTERNAL MUTATION ===");
console.log(
  "Changing instance.options.failClosed from",
  ega.options.failClosed,
  "to false"
);

ega.options.failClosed = false;

console.log(
  "instance.options.failClosed =",
  ega.options.failClosed
);

const after = runGuard(
  ega,
  "B — AFTER DIRECT MUTATION"
);

console.log("\n=== COMPARISON ===");
console.log(
  "BEFORE executionAllowed =",
  before.executionAllowed
);
console.log(
  "AFTER  executionAllowed =",
  after.executionAllowed
);
console.log(
  "BEFORE nextCalled =",
  before.nextCalled
);
console.log(
  "AFTER  nextCalled =",
  after.nextCalled
);
```

---

### 3. Run it

```bash
node state-mutation-test.cjs
```

---

## Our Raw Result

Observed output:

```text
=== COMMUNITY TEST 2 ===

ega-v9 = 1.0.3

=== INITIAL STATE ===

instance.options.failClosed = true

=== A — BEFORE DIRECT MUTATION ===

instance.options.failClosed = true
detection.status = mismatch
containment.activated = true
containment.mode = fail-closed
executionAllowed = false
nextCalled = false
response.statusCode = 409

=== DIRECT EXTERNAL MUTATION ===

Changing instance.options.failClosed from true to false
instance.options.failClosed = false

=== B — AFTER DIRECT MUTATION ===

instance.options.failClosed = false
detection.status = mismatch
containment.activated = true
containment.mode = observe
executionAllowed = true
nextCalled = true
response.statusCode = 200

=== COMPARISON ===

BEFORE executionAllowed = false
AFTER  executionAllowed = true
BEFORE nextCalled = false
AFTER  nextCalled = true
```

---

## What to Verify Yourself

Run the exact test and compare these values:

```text
BEFORE

failClosed = true
detection.status = mismatch
containment.activated = true
containment.mode = fail-closed
executionAllowed = false
nextCalled = false
response.statusCode = 409
```

and:

```text
AFTER

failClosed = false
detection.status = mismatch
containment.activated = true
containment.mode = observe
executionAllowed = true
nextCalled = true
response.statusCode = 200
```

The important comparison is:

```text
BEFORE executionAllowed = false
AFTER  executionAllowed = true

BEFORE nextCalled = false
AFTER  nextCalled = true
```

---

## What It Means

In this tested EGA V9 runtime configuration:

1. The deliberate replay-root mismatch was detected both before and after the state mutation.

2. With:

```text
failClosed = true
```

EGA activated containment, reported:

```text
executionAllowed = false
```

and did not call the downstream `next` function.

3. Application code with access to the EGA instance was able to directly execute:

```javascript
ega.options.failClosed = false;
```

outside the governance check.

4. After that mutation, the same deliberate mismatch was still detected, but the observed governance result changed to:

```text
containment.mode = observe
executionAllowed = true
nextCalled = true
```

---

## Observed Capability Boundary

For this exact tested configuration:

> **Governance-relevant runtime state stored in the EGA instance was directly mutable by application code with access to that instance, and changing `failClosed` altered the execution decision for the same detected replay-root mismatch.**

This is an observed capability boundary of this tested runtime path.

It does **not** establish that:

- every possible EGA V9 integration behaves the same way;
- a remote attacker can obtain access to the EGA instance;
- operating-system or hardware protections are bypassed;
- arbitrary process memory can be modified;
- JavaScript provides or does not provide a complete security boundary;
- language-level ownership, capability systems, cryptography, or hardware would by themselves solve the broader problem.

Also:

```text
nextCalled = true
```

means that the EGA guard allowed control to continue to the downstream execution path in this test.

It does not mean that an external financial transaction or real-world side effect actually occurred.

---

## Classification

```text
CONFIRMED CAPABILITY BOUNDARY
```

The tested state was mutable, and the observed governance decision changed after that mutation.

No EGA V9 core code was modified.

---

## Reproduce It

**Don't trust our conclusion.**

Copy the exact test.

Run it against:

```text
ega-v9@1.0.3
```

Compare your raw result with ours.

If your result differs, please preserve the exact code, package version, environment, and terminal output.

**Question → Code → Run → Evidence → Reproduce.**
