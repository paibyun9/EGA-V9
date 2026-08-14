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

const APPROVED_WORKFLOW = {
  steps: [
    {
      action:
        "validate-payment",

      tool:
        "payment-validator",

      input: {
        orderId:
          "T2-ORDER-001",
      },
    },

    {
      action:
        "purchase",

      tool:
        "payment-provider",

      input: {
        amount: 125,
        currency: "USD",

        recipient:
          "merchant-approved",

        destinationAccount:
          "acct-approved-001",
      },
    },
  ],
};

const REQUIRED_EVENTS = [
  "replay.mismatch",
  "mutation.detected",
  "containment.activated",
  "execution.blocked",
];

function clone(value) {
  return structuredClone(
    value
  );
}

async function captureApprovedReplayRoot() {
  const request = {
    method: "POST",

    path:
      "/t2/purchase",

    originalUrl:
      "/t2/purchase",

    url:
      "/t2/purchase",

    body: {
      workflow:
        clone(
          APPROVED_WORKFLOW
        ),
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",
    },
  };

  let nextCalls = 0;

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

  const response = {
    statusCode: 200,

    setHeader() {},

    status(code) {
      this.statusCode =
        code;

      return this;
    },

    json(body) {
      rejectCompleted(
        new Error(
          "Approved intent capture was unexpectedly blocked: " +
          JSON.stringify(
            body
          )
        )
      );
    },
  };

  const middleware =
    ega.guard({
      mode:
        "fail-closed",

      onContained(decision) {
        rejectCompleted(
          new Error(
            "Approved intent capture unexpectedly entered containment: " +
            JSON.stringify(
              decision
            )
          )
        );
      },
    });

  const timeout =
    setTimeout(
      () => {
        rejectCompleted(
          new Error(
            "Approved intent capture timed out waiting for next()."
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
        nextCalls += 1;

        if (error) {
          rejectCompleted(
            error
          );

          return;
        }

        resolveCompleted();
      }
    );

    await completed;
  } finally {
    clearTimeout(
      timeout
    );
  }

  if (nextCalls !== 1) {
    throw new Error(
      `Approved intent capture nextCalls=${nextCalls}; expected 1.`
    );
  }

  const replayRoot =
    request.ega
      ?.replayRoot ??
    request.egaDecision
      ?.verification
      ?.replayRoot ??
    null;

  if (
    typeof replayRoot !==
      "string" ||
    replayRoot.length === 0
  ) {
    throw new Error(
      "Approved replay root was not produced by EGA guard."
    );
  }

  if (
    request.egaDecision
      ?.executionAllowed !==
    true
  ) {
    throw new Error(
      "Approved intent capture was not executionAllowed=true."
    );
  }

  return replayRoot;
}
function createRequest({
  workflow,
  approvedReplayRoot,
}) {
  return {
    method: "POST",

    path:
      "/t2/purchase",

    originalUrl:
      "/t2/purchase",

    url:
      "/t2/purchase",

    body: {
      workflow:
        clone(workflow),
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",

      /*
       * The approval is represented by
       * the replay root of exactly what
       * the human/system approved.
       */
      "x-ega-expected-replay-root":
        approvedReplayRoot,
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
      state.body = body;

      resolveCompleted({
        type:
          "response",
      });
    },
  };

  return {
    state,
    response,
    completed,
    resolveCompleted,
    rejectCompleted,
  };
}

function eventTypes(body) {
  return Array.isArray(
    body?.events
  )
    ? body.events.map(
        (event) =>
          event?.type
      )
    : [];
}

async function execute({
  name,
  workflow,
  approvedReplayRoot,
}) {
  const request =
    createRequest({
      workflow,
      approvedReplayRoot,
    });

  const counters = {
    nextCalls: 0,
    downstreamCalls: 0,
    purchaseCalls: 0,
    toolCalls: 0,
    sideEffects: 0,
  };

  const {
    state,
    response,
    completed,
    resolveCompleted,
    rejectCompleted,
  } = createResponse();

  const middleware =
    ega.guard({
      mode:
        "fail-closed",

      statusCode:
        409,
    });

  const timeout =
    setTimeout(
      () => {
        rejectCompleted(
          new Error(
            `${name}: timed out`
          )
        );
      },
      2000
    );

  try {
    await Promise.resolve(
      middleware(
        request,
        response,
        (error) => {
          counters.nextCalls += 1;

          if (error) {
            resolveCompleted({
              type: "error",
            });

            throw error;
          }

          /*
           * THIS is the protected
           * real side-effect boundary.
           *
           * If a mutation reaches here,
           * T2 has failed.
           */
          counters.downstreamCalls += 1;
          counters.purchaseCalls += 1;
          counters.toolCalls += 1;
          counters.sideEffects += 1;

          resolveCompleted({
            type: "next",
          });
        }
      )
    );

    await completed;
  } finally {
    clearTimeout(
      timeout
    );
  }

  const decision =
    request.egaDecision ??
    null;

  const actualReplayRoot =
    decision
      ?.verification
      ?.replayRoot ??
    request.ega
      ?.replayRoot ??
    null;

  const events =
    eventTypes(
      state.body
    );

  return {
    name,

    approvedReplayRoot,

    actualReplayRoot,

    replayRootDiverged:
      actualReplayRoot !== null &&
      actualReplayRoot !==
        approvedReplayRoot,

    detectionStatus:
      decision
        ?.verification
        ?.detection
        ?.status ??
      request.ega
        ?.detection
        ?.status ??
      null,

    containmentRequired:
      decision
        ?.containmentRequired ??
      null,

    containmentActivated:
      decision
        ?.verification
        ?.containment
        ?.activated ??
      request.ega
        ?.containment
        ?.activated ??
      null,

    executionAllowed:
      decision
        ?.executionAllowed ??
      null,

    nextCalls:
      counters.nextCalls,

    downstreamCalls:
      counters.downstreamCalls,

    purchaseCalls:
      counters.purchaseCalls,

    toolCalls:
      counters.toolCalls,

    unauthorizedSideEffects:
      counters.sideEffects,

    statusCode:
      state.statusCode,

    responseCalls:
      state.jsonCalls,

    responseError:
      state.body
        ?.error ??
      null,

    events,

    evidenceComplete:
      REQUIRED_EVENTS
        .every(
          (eventType) =>
            events.includes(
              eventType
            )
        ),
  };
}

function amountMutation() {
  const workflow =
    clone(
      APPROVED_WORKFLOW
    );

  workflow.steps[1]
    .input.amount =
    9000;

  return workflow;
}

function recipientMutation() {
  const workflow =
    clone(
      APPROVED_WORKFLOW
    );

  workflow.steps[1]
    .input.recipient =
    "attacker-recipient";

  return workflow;
}

function toolArgumentMutation() {
  const workflow =
    clone(
      APPROVED_WORKFLOW
    );

  workflow.steps[1]
    .input.destinationAccount =
    "acct-attacker-999";

  return workflow;
}

test(
  "T2 blocks argument mutation after approval before side effect",
  async () => {
    const approvedReplayRoot =
      await captureApprovedReplayRoot();

    /*
     * CONTROL:
     * exact approved workflow must work.
     */
    const control =
      await execute({
        name:
          "approvedControl",

        workflow:
          APPROVED_WORKFLOW,

        approvedReplayRoot,
      });

    console.log();
    console.log(
      "=== T2 APPROVED CONTROL ==="
    );

    console.log(
      "Approved replay root:",
      approvedReplayRoot
    );

    console.log(
      "Actual replay root:",
      control.actualReplayRoot
    );

    console.log(
      "Replay root diverged:",
      control.replayRootDiverged
    );

    console.log(
      "Execution allowed:",
      control.executionAllowed
    );

    console.log(
      "Next calls:",
      control.nextCalls
    );

    console.log();

    assert.equal(
      control.replayRootDiverged,
      false,
      "Approved workflow must match approved intent."
    );

    assert.equal(
      control.executionAllowed,
      true,
      "Exact approved workflow must be allowed."
    );

    assert.equal(
      control.nextCalls,
      1,
      "Approved workflow must reach execution."
    );

    assert.equal(
      control.unauthorizedSideEffects,
      1,
      "Control must prove that the side-effect boundary is reachable."
    );

    /*
     * ATTACKS
     */
    const attacks = {
      amountMutation:
        await execute({
          name:
            "amountMutation",

          workflow:
            amountMutation(),

          approvedReplayRoot,
        }),

      recipientMutation:
        await execute({
          name:
            "recipientMutation",

          workflow:
            recipientMutation(),

          approvedReplayRoot,
        }),

      toolArgumentMutation:
        await execute({
          name:
            "toolArgumentMutation",

          workflow:
            toolArgumentMutation(),

          approvedReplayRoot,
        }),
    };

    const attackList =
      Object.values(
        attacks
      );

    for (
      const attack
      of attackList
    ) {
      /*
       * Approval intent and execution
       * must have diverged.
       */
      assert.equal(
        attack
          .replayRootDiverged,
        true,
        `${attack.name}: execution must differ from approved intent.`
      );

      assert.equal(
        attack
          .detectionStatus,
        "mismatch",
        `${attack.name}: mutation must be detected.`
      );

      assert.equal(
        attack
          .containmentRequired,
        true,
        `${attack.name}: containment must be required.`
      );

      assert.equal(
        attack
          .containmentActivated,
        true,
        `${attack.name}: containment must activate.`
      );

      assert.equal(
        attack
          .executionAllowed,
        false,
        `${attack.name}: mutated execution must be denied.`
      );

      assert.equal(
        attack.nextCalls,
        0,
        `${attack.name}: execution boundary must not be crossed.`
      );

      assert.equal(
        attack.purchaseCalls,
        0,
        `${attack.name}: purchase must not execute.`
      );

      assert.equal(
        attack.toolCalls,
        0,
        `${attack.name}: tool call must not execute.`
      );

      assert.equal(
        attack
          .unauthorizedSideEffects,
        0,
        `${attack.name}: no unauthorized side effect may occur.`
      );
    }

    const mutationsDetected =
      attackList.filter(
        (attack) =>
          attack
            .detectionStatus ===
          "mismatch"
      ).length;

    const mutatedExecutions =
      attackList.filter(
        (attack) =>
          attack.nextCalls > 0 ||
          attack
            .unauthorizedSideEffects >
            0
      ).length;

    const unauthorizedSideEffects =
      attackList.reduce(
        (sum, attack) =>
          sum +
          attack
            .unauthorizedSideEffects,
        0
      );

    const allDiverged =
      attackList.every(
        (attack) =>
          attack
            .replayRootDiverged ===
          true
      );

    const allBlockedBeforeSideEffect =
      attackList.every(
        (attack) =>
          attack
            .executionAllowed ===
            false &&
          attack.nextCalls === 0 &&
          attack.purchaseCalls === 0 &&
          attack.toolCalls === 0 &&
          attack
            .unauthorizedSideEffects ===
            0
      );

    const evidenceComplete =
      attackList.every(
        (attack) =>
          attack
            .evidenceComplete ===
          true
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
        "T2-argument-mutation-after-approval",

      generatedAt:
        new Date()
          .toISOString(),

      sourceCommit,

      scope:
        "IN_SCOPE",

      approvedIntent: {
        workflow:
          APPROVED_WORKFLOW,

        replayRoot:
          approvedReplayRoot,
      },

      control: {
        replayRootDiverged:
          control
            .replayRootDiverged,

        executionAllowed:
          control
            .executionAllowed,

        nextCalls:
          control.nextCalls,

        sideEffects:
          control
            .unauthorizedSideEffects,
      },

      attacks,

      metrics: {
        mutationsAttempted:
          attackList.length,

        mutationsDetected,

        mutatedExecutions,

        unauthorizedSideEffects,
      },

      backbone: {
        approvalBinding:
          allDiverged
            ? "VERIFIED"
            : "NOT_VERIFIED",

        executionDivergenceDetection:
          mutationsDetected ===
            attackList.length
            ? "VERIFIED"
            : "NOT_VERIFIED",

        preSideEffectBlocking:
          allBlockedBeforeSideEffect
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
        "t2-argument-mutation-after-approval/" +
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
        "t2-raw-result.json"
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
      "=== T2 ARGUMENT MUTATION AFTER APPROVAL ==="
    );

    console.log(
      "Approved replay root:",
      approvedReplayRoot
    );

    console.log();

    console.table(
      Object.fromEntries(
        Object.entries(
          attacks
        ).map(
          ([
            name,
            result,
          ]) => [
            name,
            {
              diverged:
                result
                  .replayRootDiverged,

              detection:
                result
                  .detectionStatus,

              contained:
                result
                  .containmentActivated,

              allowed:
                result
                  .executionAllowed,

              next:
                result
                  .nextCalls,

              sideEffects:
                result
                  .unauthorizedSideEffects,

              evidence:
                result
                  .evidenceComplete,
            },
          ]
        )
      )
    );

    console.log();

    console.log(
      "Mutations detected:",
      `${mutationsDetected}/${attackList.length}`
    );

    console.log(
      "Mutated executions:",
      mutatedExecutions
    );

    console.log(
      "Unauthorized side effects:",
      unauthorizedSideEffects
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
  }
);
