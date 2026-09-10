# Community Adversarial Test C002

## Validation → Execution Payload Binding

### 1. Your Question

What stops the body from changing between validation and commit?

Is the validation verdict bound to a hash of the exact payload that gets executed?

---

### 2. How We Translated It

We created one protected execution path.

The test:

1. Sends a workflow with `amount = 125`.
2. Lets EGA validate the original payload.
3. Mutates the payload after validation to `amount = 12500`.
4. Recomputes the replay root.
5. Observes which payload reaches the final simulated side effect.

No EGA V9 core code was modified.

This test examines a middleware execution path in which mutation occurs after EGA validation.

---

### 3. Copy & Run It Yourself

Create a fresh test directory:

```bash
mkdir ega-v9-c002-test
cd ega-v9-c002-test
npm init -y
npm install ega-v9 express
npx ega-v9 register
```

After completing License Activation, copy this file from this directory:

- [`payload-binding-test.js`](./payload-binding-test.js)

Then run:

```bash
node payload-binding-test.js
```

---

### 4. Our Raw Result

Our observed output is preserved in:

[`raw-output.txt`](./raw-output.txt)

Key observed values:

```text
HTTP status = 200
validatedExecutionAllowed = true
amountBeforeMutation = 125
amountAfterMutation = 12500
replayRootChanged = true
executedAmount = 12500
sideEffectCalls = 1
```

---

### 5. What to Verify on Your Machine

Do not rely on our conclusion.

Check whether your run produces:

```text
validatedExecutionAllowed = true
amountBeforeMutation = 125
amountAfterMutation = 12500
replayRootChanged = true
executedAmount = 12500
sideEffectCalls = 1
```

The exact replay-root strings may differ across versions or environments.
The important condition is whether the replay root changes after mutation and whether the mutated payload still reaches execution.

If your result differs, preserve the raw output and report it.

---

### 6. What It Means

In this tested middleware execution path, the payload changed after EGA validation, the replay root changed, and the mutated payload still reached the final handler.

The validation verdict was not automatically re-verified against the mutated payload before the final handler executed in this test.

This result applies only to the tested middleware execution path. It does not establish that every possible EGA V9 integration pattern behaves the same way.
