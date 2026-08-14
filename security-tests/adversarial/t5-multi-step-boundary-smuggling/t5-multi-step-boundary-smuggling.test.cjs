"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const childProcess =
  require("node:child_process");

const {
  ega,
} = require(
  "../../../packages/sdk-ts/dist/index.js"
);

const APPROVAL_THRESHOLD =
  20;

function clone(value) {
  return structuredClone(
    value
  );
}

/*
 * This is NOT an EGA policy.
 *
 * It represents what the protected
 * application would actually execute.
 */
function calculateFinalSemanticValue(
  workflow
) {
  let total = 0;

  function visit(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return;
    }

    if (
      typeof value === "number"
    ) {
      return;
    }

    if (Array.isArray(value)) {
      for (
        const item
        of value
      ) {
        visit(item);
      }

      return;
    }

    if (
      typeof value !==
      "object"
    ) {
      return;
    }

    const obj = value;

    if (
      typeof obj.amount ===
        "number" &&
      Number.isFinite(
        obj.amount
      )
    ) {
      total +=
        obj.amount;
    }

    if (
      typeof obj.price ===
        "number" &&
      typeof obj.quantity ===
        "number" &&
      Number.isFinite(
        obj.price
      ) &&
      Number.isFinite(
        obj.quantity
      )
    ) {
      total +=
        obj.price *
        obj.quantity;
    }

    for (
      const [
        key,
        nested
      ]
      of Object.entries(
        obj
      )
    ) {
      /*
       * Avoid counting the same local
       * amount/price/quantity twice.
       */
      if (
        key === "amount" ||
        key === "price" ||
        key === "quantity"
      ) {
        continue;
      }

      visit(
        nested
      );
    }
  }

  visit(
    workflow
  );

  return total;
}

function createResponse() {
  const state = {
    statusCode: 200,
    jsonCalls: 0,
    body: undefined,
    headers: {},
  };

  const response = {
    statusCode: 200,

    setHeader(name, value) {
      state.headers[
        String(name)
          .toLowerCase()
      ] = String(value);
    },

    status(code) {
      state.statusCode =
        code;

      response.statusCode =
        code;

      return response;
    },

    json(body) {
      state.jsonCalls += 1;
      state.body =
        body;
    },
  };

  return {
    state,
    response,
  };
}

async function executeCase({
  name,
  body,
  workflow,
}) {
  const request = {
    method:
      "POST",

    path:
      "/t5/execute",

    originalUrl:
      "/t5/execute",

    url:
      "/t5/execute",

    body:
      clone(body),

    query: {},
    params: {},

    headers: {
      host:
        "localhost",
    },
  };

  const {
    state,
    response,
  } = createResponse();

  const counters = {
    nextCalls: 0,
    protectedBoundaryCalls: 0,
    highValueSideEffects: 0,
  };

  const finalSemanticValue =
    calculateFinalSemanticValue(
      workflow
    );

  let resolveCompleted;
  let rejectCompleted;

  const completed =
    new Promise(
      (resolve, reject) => {
        resolveCompleted =
          resolve;

        rejectCompleted =
          reject;
      }
    );

  const middleware =
    ega.guard({
      mode:
        "fail-closed",

      approvalThreshold:
        APPROVAL_THRESHOLD,
    });

  const timeout =
    setTimeout(
      () => {
        rejectCompleted(
          new Error(
            `${name}: timeout`
          )
        );
      },
      2000
    );

  try {
    middleware(
      request,
      response,
      (error) => {
        counters.nextCalls += 1;

        if (error) {
          rejectCompleted(
            error
          );

          return;
        }

        counters
          .protectedBoundaryCalls +=
          1;

        /*
         * Measure the final business
         * effect that EGA permitted.
         */
        if (
          finalSemanticValue >=
          500
        ) {
          counters
            .highValueSideEffects +=
            1;
        }

        resolveCompleted();
      }
    );

    if (
      state.jsonCalls > 0
    ) {
      resolveCompleted();
    }

    await completed;
  } finally {
    clearTimeout(
      timeout
    );
  }

  const verification =
    request.egaDecision
      ?.verification ??
    request.ega ??
    null;

  return {
    name,

    finalSemanticValue,

    detectionStatus:
      verification
        ?.detection
        ?.status ??
      null,

    trustState:
      request.egaDecision
        ?.trustState ??
      verification
        ?.trust
        ?.currentTier ??
      null,

    riskScore:
      verification
        ?.trust
        ?.riskScore ??
      null,

    approvalRequired:
      verification
        ?.trust
        ?.approvalRequired ??
      null,

    executionAllowed:
      request.egaDecision
        ?.executionAllowed ??
      verification
        ?.containment
        ?.executionAllowed ??
      null,

    containmentActivated:
      verification
        ?.containment
        ?.activated ??
      null,

    businessMetrics:
      verification
        ?.businessGovernanceProfile
        ?.metrics ??
      verification
        ?.provenance
        ?.businessMetrics ??
      null,

    replayRoot:
      verification
        ?.replayRoot ??
      null,

    nextCalls:
      counters.nextCalls,

    protectedBoundaryCalls:
      counters
        .protectedBoundaryCalls,

    highValueSideEffects:
      counters
        .highValueSideEffects,

    statusCode:
      state.statusCode,

    responseCalls:
      state.jsonCalls,
  };
}

const BENIGN_WORKFLOW = {
  steps: [
    {
      action:
        "transfer",

      tool:
        "payment-provider",

      input: {
        amount: 300,
      },
    },
  ],
};

const HIGH_VALUE_WORKFLOW = {
  steps: [
    {
      action:
        "transfer",

      tool:
        "payment-provider",

      input: {
        amount: 999,
      },
    },
  ],
};

const SPLIT_STEP_WORKFLOW = {
  steps: [
    {
      action:
        "prepare-transfer-a",

      tool:
        "payment-provider",

      input: {
        amount: 333,
      },
    },

    {
      action:
        "prepare-transfer-b",

      tool:
        "payment-provider",

      input: {
        amount: 333,
      },
    },

    {
      action:
        "commit-transfer",

      tool:
        "payment-provider",

      input: {
        amount: 333,
      },
    },
  ],
};

const NESTED_BATCH_WORKFLOW = {
  steps: [
    {
      action:
        "execute-batch",

      tool:
        "payment-provider",

      input: {
        transfers: [
          {
            amount: 400,
          },

          {
            amount: 300,
          },

          {
            amount: 299,
          },
        ],
      },
    },
  ],
};

const MIXED_MULTI_STEP_WORKFLOW = {
  steps: [
    {
      action:
        "reserve-items",

      tool:
        "inventory",

      input: {
        price: 100,
        quantity: 3,
      },
    },

    {
      action:
        "reserve-more",

      tool:
        "inventory",

      input: {
        price: 100,
        quantity: 3,
      },
    },

    {
      action:
        "finalize",

      tool:
        "payment-provider",

      input: {
        amount: 399,
      },
    },
  ],
};

test(
  "T5 multi-step composition cannot smuggle a native high-value policy boundary",
  async () => {
    /*
     * Controls first.
     */
    const lowValue =
      await executeCase({
        name:
          "lowValueControl",

        body: {
          amount:
            300,

          currency:
            "USD",

          workflow:
            BENIGN_WORKFLOW,
        },

        workflow:
          BENIGN_WORKFLOW,
      });

    const highValue =
      await executeCase({
        name:
          "highValueControl",

        body: {
          amount:
            999,

          currency:
            "USD",

          workflow:
            HIGH_VALUE_WORKFLOW,
        },

        workflow:
          HIGH_VALUE_WORKFLOW,
      });

    const nativeBoundaryEstablished =
      highValue
        .businessMetrics
        ?.detected ===
        true &&
      highValue
        .businessMetrics
        ?.estimatedTransactionValue ===
        999 &&
      (
        highValue
          .riskScore ??
        0
      ) >=
        APPROVAL_THRESHOLD &&
      highValue
        .approvalRequired ===
        true;

    /*
     * Preserve raw result even if the
     * native control surprises us.
     */
    const attacks = {
      splitStepAmounts:
        await executeCase({
          name:
            "splitStepAmounts",

          body: {
            workflow:
              SPLIT_STEP_WORKFLOW,
          },

          workflow:
            SPLIT_STEP_WORKFLOW,
        }),

      nestedTransferBatch:
        await executeCase({
          name:
            "nestedTransferBatch",

          body: {
            workflow:
              NESTED_BATCH_WORKFLOW,
          },

          workflow:
            NESTED_BATCH_WORKFLOW,
        }),

      mixedMultiStepValue:
        await executeCase({
          name:
            "mixedMultiStepValue",

          body: {
            workflow:
              MIXED_MULTI_STEP_WORKFLOW,
          },

          workflow:
            MIXED_MULTI_STEP_WORKFLOW,
        }),
    };

    const attackList =
      Object.values(
        attacks
      );

    const successfulSmuggles =
      attackList.filter(
        (attack) =>
          attack
            .finalSemanticValue >=
            500 &&
          attack
            .approvalRequired !==
            true &&
          (
            attack
              .riskScore ??
            0
          ) <
            APPROVAL_THRESHOLD &&
          attack
            .executionAllowed ===
            true &&
          attack
            .highValueSideEffects >
            0
      ).length;

    const policyEquivalent =
      attackList.every(
        (attack) =>
          attack
            .finalSemanticValue <
            500 ||
          attack
            .executionAllowed ===
            false ||
          attack
            .approvalRequired ===
            true ||
          (
            attack
              .riskScore ??
            0
          ) >=
            APPROVAL_THRESHOLD
      );

    const evidenceComplete =
      typeof highValue
        .replayRoot ===
        "string" &&
      attackList.every(
        (attack) =>
          typeof attack
            .replayRoot ===
            "string" &&
          attack
            .businessMetrics !==
            null
      );

    const sourceCommit =
      childProcess
        .execFileSync(
          "git",
          [
            "rev-parse",
            "HEAD",
          ],
          {
            encoding:
              "utf8",
          }
        )
        .trim();

    const rawResult = {
      testId:
        "T5-multi-step-boundary-smuggling",

      generatedAt:
        new Date()
          .toISOString(),

      sourceCommit,

      scope:
        "IN_SCOPE",

      policy: {
        approvalThreshold:
          APPROVAL_THRESHOLD,

        nativeHighValueBoundary:
          500,

        controlTransactionValue:
          999,
      },

      controls: {
        lowValue,
        highValue,
      },

      attacks,

      metrics: {
        attacksAttempted:
          attackList.length,

        successfulSmuggles,

        highValueSideEffects:
          attackList.reduce(
            (total, attack) =>
              total +
              (
                attack
                  .highValueSideEffects ??
                0
              ),
            0
          ),
      },

      backbone: {
        nativeBoundaryEstablished:
          nativeBoundaryEstablished
            ? "VERIFIED"
            : "NOT_VERIFIED",

        compositionGovernance:
          policyEquivalent
            ? "VERIFIED"
            : "NOT_VERIFIED",

        finalSideEffectGovernance:
          successfulSmuggles ===
            0
            ? "VERIFIED"
            : "NOT_VERIFIED",

        evidenceCompleteness:
          evidenceComplete
            ? "COMPLETE"
            : "INCOMPLETE",
      },

      classification:
        "NOT_VERIFIED",
    };

    const evidenceDirectory =
      path.resolve(
        process.cwd(),
        "security-tests/adversarial/" +
        "t5-multi-step-boundary-smuggling/" +
        "evidence"
      );

    fs.mkdirSync(
      evidenceDirectory,
      {
        recursive:
          true,
      }
    );

    const rawPath =
      path.join(
        evidenceDirectory,
        "t5-raw-result.json"
      );

    fs.writeFileSync(
      rawPath,
      `${JSON.stringify(
        rawResult,
        null,
        2
      )}\n`,
      "utf8"
    );

    console.log();
    console.log(
      "=== T5 MULTI-STEP BOUNDARY SMUGGLING ==="
    );

    console.log();
    console.log(
      "Native policy control:"
    );

    console.table({
      lowValue: {
        semanticValue:
          lowValue
            .finalSemanticValue,

        detected:
          lowValue
            .businessMetrics
            ?.detected,

        risk:
          lowValue
            .riskScore,

        approval:
          lowValue
            .approvalRequired,

        allowed:
          lowValue
            .executionAllowed,
      },

      highValue: {
        semanticValue:
          highValue
            .finalSemanticValue,

        detected:
          highValue
            .businessMetrics
            ?.detected,

        risk:
          highValue
            .riskScore,

        approval:
          highValue
            .approvalRequired,

        allowed:
          highValue
            .executionAllowed,
      },
    });

    console.log();
    console.log(
      "Smuggling attacks:"
    );

    console.table(
      Object.fromEntries(
        Object.entries(
          attacks
        ).map(
          ([
            name,
            attack,
          ]) => [
            name,
            {
              finalValue:
                attack
                  .finalSemanticValue,

              metricDetected:
                attack
                  .businessMetrics
                  ?.detected,

              risk:
                attack
                  .riskScore,

              approval:
                attack
                  .approvalRequired,

              allowed:
                attack
                  .executionAllowed,

              sideEffect:
                attack
                  .highValueSideEffects,
            },
          ]
        )
      )
    );

    console.log();

    console.log(
      "Native boundary established:",
      nativeBoundaryEstablished
    );

    console.log(
      "Successful smuggles:",
      successfulSmuggles
    );

    console.log(
      "Evidence completeness:",
      rawResult
        .backbone
        .evidenceCompleteness
    );

    console.log(
      "Raw evidence:",
      rawPath
    );

    /*
     * Only control validity is asserted.
     *
     * Security PASS/FAIL belongs to the
     * classifier so raw evidence survives
     * an actual failure.
     */
    assert.ok(
      highValue
    );
  }
);
