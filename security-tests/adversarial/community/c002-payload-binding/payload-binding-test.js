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
