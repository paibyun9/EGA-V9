# Community Adversarial Test C001

## N+1 Tool / Route Coverage Drift

### 1. Your Question

If N tools/routes are already governed, what happens when an N+1 route is added?

Is it governed by default, or can it execute outside the governance boundary?

---

### 2. How We Translated It

We created three routes:

- `protected-a` → EGA guard
- `protected-b` → EGA guard
- `uncovered-c` → intentionally added without an EGA guard

No EGA V9 core code was modified.

This test examines a route-level guard configuration.

---

### 3. Copy & Run It Yourself

Create a fresh test directory:

```bash
mkdir ega-v9-c001-test
cd ega-v9-c001-test
npm init -y
npm install ega-v9 express
npx ega-v9 register
```

After completing License Activation, copy these two files from this directory:

- [`app.js`](./app.js)
- [`runtime-test.js`](./runtime-test.js)

Then run:

```bash
node runtime-test.js
```

---

### 4. Our Raw Result

Our observed output is preserved in:

[`raw-output.txt`](./raw-output.txt)

Key observed values:

```text
protected route status = 400
protectedCalls = 0

uncovered route status = 200
uncoveredCalls = 1
```

---

### 5. What to Verify on Your Machine

Do not rely on our conclusion.

Check whether your run produces:

```text
protectedCalls = 0
uncovered route status = 200
uncoveredCalls = 1
```

If your result differs, preserve the raw output and report it.

---

### 6. What It Means

In this tested route-level guard configuration, the N+1 route added without the EGA guard was not automatically covered and executed successfully.

This result applies only to the tested configuration. It does not establish that every possible EGA V9 integration pattern behaves the same way.
