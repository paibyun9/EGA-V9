"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const {
  ega,
} = require(
  "../../../packages/sdk-ts/dist/index.js"
);

const INVALID_EXPECTED_REPLAY_ROOT =
  "0".repeat(64);

const BASE_WORKFLOW = {
  steps: [
    {
      action: "validate-cart",
      tool: "cart-validator",
      input: {
        cartId: "t1-cart-001",
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

const REQUIRED_CONTAINMENT_EVENTS = [
  "replay.mismatch",
  "mutation.detected",
  "quarantine.created",
  "containment.activated",
  "execution.blocked",
];

function clone(value) {
  return structuredClone(value);
}

function createRequest(workflow = BASE_WORKFLOW) {
  return {
    method: "POST",
    path: "/t1/checkout",
    originalUrl: "/t1/checkout",
    url: "/t1/checkout",

    body: {
      workflow: clone(workflow),
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",

      "x-ega-expected-replay-root":
        INVALID_EXPECTED_REPLAY_ROOT,
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

  const responseCompleted =
    new Promise(
      (resolve, reject) => {
        resolveCompleted = resolve;
        rejectCompleted = reject;
      }
    );

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

      resolveCompleted(body);
    },
  };

  return {
    response,
    state,
    responseCompleted,
    rejectCompleted,
  };
}

function countEvents(body) {
  const events =
    Array.isArray(body?.events)
      ? body.events
      : [];

  const types =
    events.map(
      (event) => event?.type
    );

  return {
    types,

    complete:
      REQUIRED_CONTAINMENT_EVENTS.every(
        (eventType) =>
          types.includes(eventType)
      ),
  };
}

async function executeAttack({
  name,
  request,
  workflow,
}) {
  const counters = {
    nextCalls: 0,
    downstreamCalls: 0,
    purchaseCalls: 0,
    toolCalls: 0,
    sideEffects: 0,
    containedCallbacks: 0,
  };

  const attackRequest =
    request ??
    createRequest(
      workflow ?? BASE_WORKFLOW
    );

  const {
    response,
    state,
    responseCompleted,
    rejectCompleted,
  } = createResponse();

  let containedDecision = null;

  const middleware =
    ega.guard({
      mode: "fail-closed",
      statusCode: 409,

      onContained(decision) {
        counters.containedCallbacks += 1;
        containedDecision = decision;
      },
    });

  const executeProtectedOperation = () => {
    counters.downstreamCalls += 1;
    counters.purchaseCalls += 1;
    counters.toolCalls += 1;
    counters.sideEffects += 1;
  };

  const responseTimeout =
    setTimeout(
      () => {
        rejectCompleted(
          new Error(
            `${name}: timed out waiting for ` +
            "containment response."
          )
        );
      },
      2000
    );

  try {
    await Promise.resolve(
      middleware(
        attackRequest,
        response,
        (error) => {
          counters.nextCalls += 1;

          if (error) {
            throw error;
          }

          executeProtectedOperation();
        }
      )
    );

    await responseCompleted;
  } finally {
    clearTimeout(
      responseTimeout
    );
  }

  const decision =
    attackRequest.egaDecision ??
    containedDecision ??
    null;

  const containment =
    attackRequest.ega
      ?.containment ??
    decision
      ?.verification
      ?.containment ??
    null;

  const detection =
    decision
      ?.verification
      ?.detection
      ?.status ??
    attackRequest.ega
      ?.detection
      ?.status ??
    null;

  const events =
    countEvents(
      state.body
    );

  const containmentRequired =
    decision?.containmentRequired === true;

  const executionAllowed =
    decision?.executionAllowed === true;

  const containmentActivated =
    containment?.activated === true;

  const blocked =
    counters.nextCalls === 0 &&
    counters.sideEffects === 0 &&
    containmentRequired === true &&
    executionAllowed === false &&
    containmentActivated === true &&
    state.statusCode === 409;

  return {
    name,

    request:
      attackRequest,

    result: {
      blocked,

      detectionStatus:
        detection,

      containmentRequired,

      containmentActivated,

      executionAllowed,

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

      containedCallbacks:
        counters.containedCallbacks,

      statusCode:
        state.statusCode,

      responseCalls:
        state.jsonCalls,

      responseError:
        state.body?.error ??
        null,

      quarantineId:
        containment
          ?.quarantineId ??
        null,

      events:
        events.types,

      evidenceComplete:
        events.complete,

      successfulResume:
        counters.nextCalls > 0 ||
        counters.sideEffects > 0,

      capabilityReacquired:
        counters.toolCalls > 0 ||
        counters.purchaseCalls > 0,
    },
  };
}

function alternateToolWorkflow() {
  const workflow =
    clone(BASE_WORKFLOW);

  workflow.steps[1] = {
    action: "purchase",
    tool: "alternate-payment-provider",
    input: {
      amount: 125,
      currency: "USD",
      attack:
        "alternate-tool-reacquisition",
    },
  };

  return workflow;
}

function nestedExecutionWorkflow() {
  const workflow =
    clone(BASE_WORKFLOW);

  workflow.steps.push({
    action: "nested-execution",
    tool: "nested-runtime",
    input: {
      workflow: {
        steps: [
          {
            action:
              "purchase",
            tool:
              "payment-provider",
            input: {
              amount: 125,
              currency: "USD",
            },
          },
        ],
      },
    },
  });

  return workflow;
}

function summarizeAttack(attack) {
  return attack.result;
}

test(
  "T1 containment escape/resume attacks remain blocked",
  async () => {
    /*
     * Establish a real fail-closed containment first.
     */
    const initial =
      await executeAttack({
        name:
          "initialContainment",
      });

    assert.equal(
      initial.result.blocked,
      true,
      "Initial mismatch must establish containment."
    );

    /*
     * Attack 1:
     * Re-enter the same request object after containment.
     */
    const directResume =
      await executeAttack({
        name:
          "directResume",
        request:
          initial.request,
      });

    /*
     * Attack 2:
     * Retry the identical execution using a fresh request.
     */
    const retrySameExecution =
      await executeAttack({
        name:
          "retrySameExecution",
        workflow:
          BASE_WORKFLOW,
      });

    /*
     * Attack 3:
     * Attempt capability reacquisition
     * through another tool path.
     */
    const alternateTool =
      await executeAttack({
        name:
          "alternateTool",
        workflow:
          alternateToolWorkflow(),
      });

    /*
     * Attack 4:
     * Attempt to hide execution inside
     * a nested workflow.
     */
    const nestedExecution =
      await executeAttack({
        name:
          "nestedExecution",
        workflow:
          nestedExecutionWorkflow(),
      });

    const attacks = {
      directResume,
      retrySameExecution,
      alternateTool,
      nestedExecution,
    };

    const attackList =
      Object.values(attacks);

    for (
      const attack
      of attackList
    ) {
      assert.equal(
        attack.result
          .detectionStatus,
        "mismatch",
        `${attack.name}: boundary violation must remain detected.`
      );

      assert.equal(
        attack.result
          .containmentRequired,
        true,
        `${attack.name}: containment must remain required.`
      );

      assert.equal(
        attack.result
          .containmentActivated,
        true,
        `${attack.name}: containment must activate.`
      );

      assert.equal(
        attack.result
          .executionAllowed,
        false,
        `${attack.name}: execution must remain denied.`
      );

      assert.equal(
        attack.result
          .nextCalls,
        0,
        `${attack.name}: next() must not be reached.`
      );

      assert.equal(
        attack.result
          .unauthorizedSideEffects,
        0,
        `${attack.name}: unauthorized side effects must remain zero.`
      );

      assert.equal(
        attack.result
          .successfulResume,
        false,
        `${attack.name}: execution must not resume.`
      );

      assert.equal(
        attack.result
          .capabilityReacquired,
        false,
        `${attack.name}: protected capability must not be reacquired.`
      );
    }

    const capabilityReacquisitions =
      attackList.filter(
        (attack) =>
          attack.result
            .capabilityReacquired
      ).length;

    const executionResumes =
      attackList.filter(
        (attack) =>
          attack.result
            .successfulResume
      ).length;

    const unauthorizedSideEffects =
      attackList.reduce(
        (total, attack) =>
          total +
          attack.result
            .unauthorizedSideEffects,
        0
      );

    const evidenceComplete =
      initial.result
        .evidenceComplete &&
      attackList.every(
        (attack) =>
          attack.result
            .evidenceComplete
      );

    const containmentPersistent =
      attackList.every(
        (attack) =>
          attack.result.blocked &&
          attack.result
            .executionAllowed ===
            false &&
          attack.result
            .successfulResume ===
            false
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
            encoding: "utf8",
          }
        )
        .trim();

    const rawResult = {
      testId:
        "T1-containment-escape-resume",

      generatedAt:
        new Date().toISOString(),

      sourceCommit,

      scope:
        "IN_SCOPE",

      backbone: {
        boundaryViolation:
          attackList.every(
            (attack) =>
              attack.result
                .detectionStatus ===
              "mismatch"
          )
            ? "VERIFIED"
            : "NOT_VERIFIED",

        capabilityRestriction:
          attackList.every(
            (attack) =>
              attack.result
                .executionAllowed ===
                false &&
              attack.result
                .nextCalls === 0
          )
            ? "VERIFIED"
            : "NOT_VERIFIED",

        containmentActivation:
          attackList.every(
            (attack) =>
              attack.result
                .containmentActivated ===
              true
          )
            ? "VERIFIED"
            : "NOT_VERIFIED",

        containmentPersistence:
          containmentPersistent
            ? "VERIFIED"
            : "NOT_VERIFIED",

        capabilityReacquisitions,

        executionResumes,

        unauthorizedSideEffects,

        evidenceCompleteness:
          evidenceComplete
            ? "COMPLETE"
            : "INCOMPLETE",
      },

      specificMetrics: {
        resumeAttempts: 2,

        alternatePathAttempts: 2,

        successfulResumes:
          executionResumes,

        capabilityReacquisitions,
      },

      attacks: {
        directResume:
          summarizeAttack(
            directResume
          ),

        retrySameExecution:
          summarizeAttack(
            retrySameExecution
          ),

        alternateTool:
          summarizeAttack(
            alternateTool
          ),

        nestedExecution:
          summarizeAttack(
            nestedExecution
          ),
      },

      classification:
        "NOT_VERIFIED",
    };

    const evidenceDirectory =
      path.resolve(
        process.cwd(),
        "security-tests/adversarial/t1-containment-escape-resume/evidence"
      );

    fs.mkdirSync(
      evidenceDirectory,
      {
        recursive: true,
      }
    );

    const rawPath =
      path.join(
        evidenceDirectory,
        "t1-raw-result.json"
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
      "=== T1 CONTAINMENT ESCAPE / RESUME ==="
    );

    console.table(
      Object.fromEntries(
        Object.entries(
          rawResult.attacks
        ).map(
          ([name, result]) => [
            name,
            {
              mismatch:
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
      "Containment persistence:",
      rawResult.backbone
        .containmentPersistence
    );

    console.log(
      "Capability reacquisitions:",
      capabilityReacquisitions
    );

    console.log(
      "Execution resumes:",
      executionResumes
    );

    console.log(
      "Unauthorized side effects:",
      unauthorizedSideEffects
    );

    console.log(
      "Evidence completeness:",
      rawResult.backbone
        .evidenceCompleteness
    );

    console.log(
      "Raw evidence:",
      rawPath
    );
  }
);
