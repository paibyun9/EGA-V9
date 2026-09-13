# Hi @captainarlock,

**Proof before explanation.**

Thank you for taking the time to raise these questions about EGA V9.

Rather than answering them only with an explanation, we translated your questions into executable tests against the currently published EGA V9 package.

We followed this sequence:

**Your Question → How We Translated It → Copy & Run → Our Raw Result → What It Means**

Please feel free to reproduce the tests yourself. If you encounter any problem while running them, let us know anytime.

And if your result differs from ours, we genuinely want to see it. Different or contradictory results are always welcome — they help us identify what the evidence actually supports and where EGA V9's boundaries are.

Proof before explanation.

Let's begin.

---

# Question 1 — N+1 Tool / Route Coverage Drift

## Your Question

If N tools/routes are already governed, what happens when an N+1 route is added?

Is it governed by default, or can it execute outside the governance boundary?

## Test

We use three routes:

- `protected-a` — EGA guard
- `protected-b` — EGA guard
- `uncovered-c` — intentionally added without EGA guard

The developer can see exactly which route is governed and which route is not before running the test.

## Copy & Run

Create a fresh directory and install EGA V9:

```bash
mkdir ega-v9-test-1-q1
cd ega-v9-test-1-q1
npm init -y
npm install ega-v9@1.0.4 express@5.2.1
npx ega-v9 register
```


Complete the normal License Activation.

Now create the test application:

```bash
cat > app.js <<'EOF'
const express = require("express");
const { ega } = require("ega-v9");

const app = express();
app.use(express.json());

let protectedCalls = 0;
let uncoveredCalls = 0;

const guard = ega.guard({
  mode: "fail-closed",
});

app.post(
  "/protected-a",
  guard,
  (req, res) => {
    protectedCalls += 1;
    res.json({
      route: "protected-a",
      protectedCalls,
    });
  }
);

app.post(
  "/protected-b",
  guard,
  (req, res) => {
    protectedCalls += 1;
    res.json({
      route: "protected-b",
      protectedCalls,
    });
  }
);

/*
 * N+1 route intentionally added WITHOUT EGA guard.
 */
app.post(
  "/uncovered-c",
  (req, res) => {
    uncoveredCalls += 1;
    res.json({
      route: "uncovered-c",
      uncoveredCalls,
    });
  }
);

module.exports = {
  app,
  getState() {
    return {
      protectedCalls,
      uncoveredCalls,
    };
  },
};
EOF
```


Now create the runtime test:

```bash
cat > runtime-test.js <<'EOF'
const { app, getState } = require("./app");

async function main() {
  const server = app.listen(0);

  await new Promise((resolve) =>
    server.once("listening", resolve)
  );

  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    console.log("\n=== INITIAL STATE ===");
    console.log(getState());

    console.log("\n=== PROTECTED ROUTE ===");

    const protectedResponse = await fetch(
      `${base}/protected-a`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    console.log("status:", protectedResponse.status);
    console.log("body:", await protectedResponse.text());
    console.log("state after protected:", getState());

    console.log("\n=== N+1 UNCOVERED ROUTE ===");

    const uncoveredResponse = await fetch(
      `${base}/uncovered-c`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    console.log("status:", uncoveredResponse.status);
    console.log("body:", await uncoveredResponse.text());
    console.log("state after uncovered:", getState());

  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
EOF
```


Run:

```bash
node runtime-test.js
```


## Our Observed Result

```text
=== INITIAL STATE ===
{ protectedCalls: 0, uncoveredCalls: 0 }

=== PROTECTED ROUTE ===
status: 400
body: {"ok":false,"error":"EGA_INVALID_WORKFLOW","message":"Workflow must be a valid action, step array, or object containing steps.","containmentRequired":true,"executionAllowed":false,"latencyMicroseconds":191.375}
state after protected: { protectedCalls: 0, uncoveredCalls: 0 }

=== N+1 UNCOVERED ROUTE ===
status: 200
body: {"route":"uncovered-c","uncoveredCalls":1}
state after uncovered: { protectedCalls: 0, uncoveredCalls: 1 }
```


## What to Verify Yourself

From your own terminal, check:


```text
protected route status = 400
protectedCalls = 0

N+1 uncovered route status = 200
uncoveredCalls = 1
```


## What It Means

In this tested route-level guard configuration, the N+1 route added without the EGA guard was not automatically covered and executed successfully.

This observation applies to this exact tested configuration. It does not establish that every possible EGA V9 integration pattern behaves the same way.

---

# Question 2 — Validation → Execution Payload Binding

## Your Question

> What stops the body from changing between validation and commit? Is the validation verdict bound to a hash of the exact payload that gets executed?

## Test

The developer can inspect the exact values before running the test:


```text
Original amount: 125
Post-validation mutation: 12500
```


The test then checks:

1. whether EGA allows the original payload,
2. whether the payload changes after validation,
3. whether the replay root changes,
4. which amount reaches the final handler.

## Copy & Run

Create a fresh directory and install EGA V9:

```bash
mkdir ega-v9-test-1-q2
cd ega-v9-test-1-q2
npm init -y
npm install ega-v9@1.0.3 express@5.2.1
npx ega-v9 register
```


Complete the normal License Activation if required.

Now create the exact test:

```bash
cat > payload-binding-test.js <<'EOF'
const express = require("express");
const { ega, EGA } = require("ega-v9");

const app = express();
app.use(express.json());

let sideEffectCalls = 0;

const rootInspector = EGA.init({
  telemetry: false,
});

const guard = ega.guard({
  mode: "fail-closed",
});

app.post(
  "/payload-binding",

  // 1. EGA validates the original payload.
  guard,

  // 2. AFTER validation, deliberately mutate it.
  (req, res, next) => {
    const validatedReplayRoot =
      req.egaDecision?.verification?.replayRoot ?? null;

    const validatedExecutionAllowed =
      req.egaDecision?.executionAllowed ?? null;

    const amountBeforeMutation =
      req.body?.workflow?.steps?.[0]?.input?.amount;

    req.body.workflow.steps[0].input.amount = 12500;

    const amountAfterMutation =
      req.body.workflow.steps[0].input.amount;

    const mutatedReplayRoot =
      rootInspector.replayRoot(
        req.body.workflow
      );

    req.payloadBindingObservation = {
      validatedExecutionAllowed,
      validatedReplayRoot,
      amountBeforeMutation,
      amountAfterMutation,
      mutatedReplayRoot,
      replayRootChanged:
        validatedReplayRoot !== mutatedReplayRoot,
    };

    next();
  },

  // 3. Simulated protected side effect.
  (req, res) => {
    sideEffectCalls += 1;

    res.json({
      ok: true,
      sideEffectCalls,
      executedAmount:
        req.body.workflow.steps[0].input.amount,
      observation:
        req.payloadBindingObservation,
    });
  }
);

async function main() {
  const server = app.listen(0);

  await new Promise((resolve) =>
    server.once("listening", resolve)
  );

  const port = server.address().port;

  try {
    const workflow = {
      steps: [
        {
          action: "purchase",
          tool: "payment-provider",
          input: {
            amount: 125,
            currency: "USD",
            recipient: "merchant-approved",
          },
        },
      ],
    };

    console.log(
      "\n=== ORIGINAL PAYLOAD BEFORE EGA VALIDATION ==="
    );

    console.log(
      JSON.stringify(workflow, null, 2)
    );

    const response = await fetch(
      `http://127.0.0.1:${port}/payload-binding`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workflow,
        }),
      }
    );

    console.log(
      "\n=== HTTP STATUS ==="
    );

    console.log(response.status);

    console.log(
      "\n=== FINAL EXECUTION RESULT ==="
    );

    console.log(
      JSON.stringify(
        await response.json(),
        null,
        2
      )
    );
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
EOF
```


Before running it, inspect these two lines in the code yourself:


```js
amount: 125

req.body.workflow.steps[0].input.amount = 12500;
```


Now run:

```bash
node payload-binding-test.js
```


## Our Observed Result

```text
=== ORIGINAL PAYLOAD BEFORE EGA VALIDATION ===
{
  "steps": [
    {
      "action": "purchase",
      "tool": "payment-provider",
      "input": {
        "amount": 125,
        "currency": "USD",
        "recipient": "merchant-approved"
      }
    }
  ]
}

=== HTTP STATUS ===
200

=== FINAL EXECUTION RESULT ===
{
  "ok": true,
  "sideEffectCalls": 1,
  "executedAmount": 12500,
  "observation": {
    "validatedExecutionAllowed": true,
    "validatedReplayRoot": "5e58d085b71ebe881071f1764d6ba1b4d5e1d9223ff422ce3d2ad7af2bce27e3",
    "amountBeforeMutation": 125,
    "amountAfterMutation": 12500,
    "mutatedReplayRoot": "9940d344c1a2d829b0961c77103cd845ca89e04f151ecf73945eeb95c3074981",
    "replayRootChanged": true
  }
}
```


## What to Verify Yourself

Do not rely on our interpretation. Check these values from your own run:


```text
amountBeforeMutation = 125
amountAfterMutation = 12500
validatedExecutionAllowed = true
replayRootChanged = true
executedAmount = 12500
sideEffectCalls = 1
```


The exact replay-root strings do not need to match across every environment.

The important observation is:


```text
validatedReplayRoot != mutatedReplayRoot
```


while the mutated payload still reaches the final handler in this test.

## What It Means

In this tested middleware execution path, the payload changed after EGA validation, the replay root changed, and the mutated payload still reached the final handler.

The validation verdict was not automatically re-verified against the mutated payload before the final handler executed in this test.

This observation applies only to this tested middleware execution path. It does not establish that every possible EGA V9 integration pattern behaves the same way.

---

# Final Principle

**Don't trust our conclusion. Run the exact test.**

**Question → Copy → Run → Observe**

If your result differs, preserve your terminal output and report what you observed.
