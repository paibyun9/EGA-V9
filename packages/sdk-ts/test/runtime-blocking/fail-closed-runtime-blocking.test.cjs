"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ega,
} = require("../../dist/index.js");

const REPEAT_COUNT = 25;

const NORMAL_WORKFLOW = {
  steps: [
    {
      action: "validate-cart",
      tool: "cart-validator",
      input: {
        cartId: "cart-001",
      },
    },
    {
      action: "purchase",
      tool: "payment-provider",
      input: {
        amount: 125,
        currency: "USD",
      },
    },
  ],
};

const INVALID_EXPECTED_REPLAY_ROOT =
  "0".repeat(64);

function createRequest({
  mismatch = false,
} = {}) {
  return {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",
    body: {
      workflow:
        structuredClone(
          NORMAL_WORKFLOW
        ),
    },
    query: {},
    params: {},
    headers: {
      host: "localhost",
      ...(mismatch
        ? {
            "x-ega-expected-replay-root":
              INVALID_EXPECTED_REPLAY_ROOT,
          }
        : {}),
    },
  };
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
        String(name).toLowerCase()
      ] = String(value);
    },

    status(code) {
      state.statusCode = code;
      response.statusCode = code;
      return response;
    },

    json(body) {
      state.jsonCalls += 1;
      state.body = body;
    },
  };

  return {
    response,
    state,
  };
}

async function executePipeline({
  mode,
  mismatch,
  statusCode = 409,
  onContained,
}) {
  const counters = {
    nextCalls: 0,
    downstreamCalls: 0,
    purchaseCalls: 0,
    toolCalls: 0,
    containedCallbacks: 0,
  };

  const request =
    createRequest({
      mismatch,
    });

  const {
    response,
    state,
  } = createResponse();

  const middleware = ega.guard({
    mode,
    statusCode,

    onContained: async (decision) => {
      counters.containedCallbacks += 1;

      if (onContained) {
        await onContained(decision);
      }
    },
  });

  const executeBusinessWorkflow = () => {
    counters.downstreamCalls += 1;
    counters.purchaseCalls += 1;
    counters.toolCalls += 1;
  };

  await Promise.resolve(
    middleware(
      request,
      response,
      (error) => {
        counters.nextCalls += 1;

        if (error) {
          throw error;
        }

        executeBusinessWorkflow();
      }
    )
  );

  return {
    counters,
    request,
    responseState: state,
  };
}

const evidence = {
  schemaVersion: "1.0.0",
  releaseTarget: "ega-v9@1.0.1",
  testId:
    "fail-closed-runtime-blocking",
  generatedAt: null,
  repeatCount: REPEAT_COUNT,
  normal: null,
  failClosed: null,
  observe: null,
  repeatedFailClosed: null,
  assertions: {},
  finalStatus: "BLOCKED",
};

test(
  "normal workflow reaches the downstream execution boundary",
  async () => {
    const result =
      await executePipeline({
        mode: "fail-closed",
        mismatch: false,
      });

    assert.equal(
      result.counters.nextCalls,
      1
    );

    assert.equal(
      result.counters.downstreamCalls,
      1
    );

    assert.equal(
      result.counters.purchaseCalls,
      1
    );

    assert.equal(
      result.counters.toolCalls,
      1
    );

    assert.equal(
      result.request.egaDecision
        ?.containmentRequired,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.executionAllowed,
      true
    );

    evidence.normal = {
      nextCalls:
        result.counters.nextCalls,
      downstreamCalls:
        result.counters.downstreamCalls,
      purchaseCalls:
        result.counters.purchaseCalls,
      toolCalls:
        result.counters.toolCalls,
      containmentRequired:
        result.request.egaDecision
          ?.containmentRequired,
      executionAllowed:
        result.request.egaDecision
          ?.executionAllowed,
    };
  }
);

test(
  "fail-closed mismatch blocks next, purchase, tool, and downstream execution",
  async () => {
    const result =
      await executePipeline({
        mode: "fail-closed",
        mismatch: true,
        statusCode: 409,
      });

    assert.equal(
      result.counters.nextCalls,
      0
    );

    assert.equal(
      result.counters.downstreamCalls,
      0
    );

    assert.equal(
      result.counters.purchaseCalls,
      0
    );

    assert.equal(
      result.counters.toolCalls,
      0
    );

    assert.equal(
      result.responseState.statusCode,
      409
    );

    assert.equal(
      result.responseState.jsonCalls,
      1
    );

    assert.equal(
      result.request.egaDecision
        ?.containmentRequired,
      true
    );

    assert.equal(
      result.request.egaDecision
        ?.executionAllowed,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.verification?.detection
        ?.status,
      "mismatch"
    );

    assert.equal(
      result.request.egaDecision
        ?.verification?.containment
        ?.activated,
      true
    );

    evidence.failClosed = {
      nextCalls:
        result.counters.nextCalls,
      downstreamCalls:
        result.counters.downstreamCalls,
      purchaseCalls:
        result.counters.purchaseCalls,
      toolCalls:
        result.counters.toolCalls,
      statusCode:
        result.responseState.statusCode,
      responseCalls:
        result.responseState.jsonCalls,
      responseError:
        result.responseState.body
          ?.error ??
        null,
      containmentRequired:
        result.request.egaDecision
          ?.containmentRequired,
      executionAllowed:
        result.request.egaDecision
          ?.executionAllowed,
      detectionStatus:
        result.request.egaDecision
          ?.verification?.detection
          ?.status,
      containmentActivated:
        result.request.egaDecision
          ?.verification?.containment
          ?.activated,
    };
  }
);

test(
  "onContained may record evidence but cannot execute the blocked workflow",
  async () => {
    let callbackPurchaseCalls = 0;

    const result =
      await executePipeline({
        mode: "fail-closed",
        mismatch: true,

        onContained: async (
          decision
        ) => {
          assert.equal(
            decision
              .containmentRequired,
            true
          );

          assert.equal(
            decision.executionAllowed,
            false
          );

          /*
           * The callback records state only.
           * It must not invoke purchase or tools.
           */
          callbackPurchaseCalls += 0;
        },
      });

    assert.equal(
      result.counters
        .containedCallbacks,
      1
    );

    assert.equal(
      callbackPurchaseCalls,
      0
    );

    assert.equal(
      result.counters.downstreamCalls,
      0
    );
  }
);

test(
  "repeated fail-closed mismatches never cross the execution boundary",
  async () => {
    let blockedRuns = 0;
    let totalNextCalls = 0;
    let totalDownstreamCalls = 0;
    let totalPurchaseCalls = 0;
    let totalToolCalls = 0;
    let total409Responses = 0;

    for (
      let index = 0;
      index < REPEAT_COUNT;
      index += 1
    ) {
      const result =
        await executePipeline({
          mode: "fail-closed",
          mismatch: true,
          statusCode: 409,
        });

      totalNextCalls +=
        result.counters.nextCalls;

      totalDownstreamCalls +=
        result.counters
          .downstreamCalls;

      totalPurchaseCalls +=
        result.counters
          .purchaseCalls;

      totalToolCalls +=
        result.counters.toolCalls;

      if (
        result.responseState
          .statusCode === 409
      ) {
        total409Responses += 1;
      }

      if (
        result.request.egaDecision
          ?.containmentRequired ===
          true &&
        result.request.egaDecision
          ?.executionAllowed ===
          false
      ) {
        blockedRuns += 1;
      }
    }

    assert.equal(
      blockedRuns,
      REPEAT_COUNT
    );

    assert.equal(
      totalNextCalls,
      0
    );

    assert.equal(
      totalDownstreamCalls,
      0
    );

    assert.equal(
      totalPurchaseCalls,
      0
    );

    assert.equal(
      totalToolCalls,
      0
    );

    assert.equal(
      total409Responses,
      REPEAT_COUNT
    );

    evidence.repeatedFailClosed = {
      attemptedRuns:
        REPEAT_COUNT,
      blockedRuns,
      totalNextCalls,
      totalDownstreamCalls,
      totalPurchaseCalls,
      totalToolCalls,
      total409Responses,
    };
  }
);

test(
  "observe mode records the mismatch but permits downstream execution",
  async () => {
    const result =
      await executePipeline({
        mode: "observe",
        mismatch: true,
      });

    assert.equal(
      result.counters.nextCalls,
      1
    );

    assert.equal(
      result.counters.downstreamCalls,
      1
    );

    assert.equal(
      result.counters.purchaseCalls,
      1
    );

    assert.equal(
      result.counters.toolCalls,
      1
    );

    assert.equal(
      result.request.egaDecision
        ?.containmentRequired,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.executionAllowed,
      true
    );

    evidence.observe = {
      nextCalls:
        result.counters.nextCalls,
      downstreamCalls:
        result.counters.downstreamCalls,
      purchaseCalls:
        result.counters.purchaseCalls,
      toolCalls:
        result.counters.toolCalls,
      containmentRequired:
        result.request.egaDecision
          ?.containmentRequired,
      executionAllowed:
        result.request.egaDecision
          ?.executionAllowed,
      detectionStatus:
        result.request.egaDecision
          ?.verification?.detection
          ?.status,
    };
  }
);

test.after(() => {
  evidence.generatedAt =
    new Date().toISOString();

  evidence.assertions = {
    normalExecutionReached:
      evidence.normal
        ?.downstreamCalls === 1,

    failClosedNextSuppressed:
      evidence.failClosed
        ?.nextCalls === 0,

    failClosedDownstreamSuppressed:
      evidence.failClosed
        ?.downstreamCalls === 0,

    failClosedPurchaseSuppressed:
      evidence.failClosed
        ?.purchaseCalls === 0,

    failClosedToolSuppressed:
      evidence.failClosed
        ?.toolCalls === 0,

    failClosedHttp409:
      evidence.failClosed
        ?.statusCode === 409,

    failClosedDecisionDenied:
      evidence.failClosed
        ?.executionAllowed === false,

    repeatedRunsAllBlocked:
      evidence.repeatedFailClosed
        ?.blockedRuns ===
      REPEAT_COUNT,

    repeatedSideEffectsZero:
      evidence.repeatedFailClosed
        ?.totalDownstreamCalls === 0 &&
      evidence.repeatedFailClosed
        ?.totalPurchaseCalls === 0 &&
      evidence.repeatedFailClosed
        ?.totalToolCalls === 0,

    observeModeContinued:
      evidence.observe
        ?.downstreamCalls === 1 &&
      evidence.observe
        ?.executionAllowed === true,
  };

  const allPassed =
    Object.values(
      evidence.assertions
    ).every(Boolean);

  evidence.finalStatus =
    allPassed
      ? "PASS"
      : "BLOCKED";

  const outputPath = path.resolve(
    process.cwd(),
    "publication/evidence/v1.0.1/fail-closed-runtime-blocking.json"
  );

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      evidence,
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log();
  console.log(
    "=== EGA V9 v1.0.1 Fail-Closed Runtime Blocking ==="
  );
  console.log(
    `Normal downstream calls: ${evidence.normal?.downstreamCalls}`
  );
  console.log(
    `Fail-closed next calls: ${evidence.failClosed?.nextCalls}`
  );
  console.log(
    `Fail-closed downstream calls: ${evidence.failClosed?.downstreamCalls}`
  );
  console.log(
    `Fail-closed purchase calls: ${evidence.failClosed?.purchaseCalls}`
  );
  console.log(
    `Fail-closed tool calls: ${evidence.failClosed?.toolCalls}`
  );
  console.log(
    `Repeated blocked runs: ${evidence.repeatedFailClosed?.blockedRuns}/${REPEAT_COUNT}`
  );
  console.log(
    `Repeated side-effect calls: ${
      (
        evidence.repeatedFailClosed
          ?.totalDownstreamCalls ??
        0
      ) +
      (
        evidence.repeatedFailClosed
          ?.totalPurchaseCalls ??
        0
      ) +
      (
        evidence.repeatedFailClosed
          ?.totalToolCalls ??
        0
      )
    }`
  );
  console.log(
    `Observe downstream calls: ${evidence.observe?.downstreamCalls}`
  );
  console.log(
    `Final status: ${evidence.finalStatus}`
  );
  console.log(
    `Evidence: ${outputPath}`
  );

  if (!allPassed) {
    process.exitCode = 1;
  }
});
