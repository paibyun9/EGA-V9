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

const INVALID_EXPECTED_REPLAY_ROOT =
  "t4-invalid-expected-replay-root";

const WORKFLOW = {
  steps: [
    {
      action:
        "validate-payment",

      tool:
        "payment-validator",

      input: {
        orderId:
          "T4-ORDER-001",
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
      },
    },
  ],
};

const REQUIRED_EVENTS = [
  "replay.mismatch",
  "mutation.detected",
  "trust.escalated",
  "approval.required",
  "containment.activated",
  "execution.blocked",
];

function clone(value) {
  return structuredClone(
    value
  );
}

function createBaseRequest() {
  return {
    method: "POST",

    path:
      "/t4/trust",

    originalUrl:
      "/t4/trust",

    url:
      "/t4/trust",

    body: {
      workflow:
        clone(
          WORKFLOW
        ),
    },

    query: {},
    params: {},

    headers: {
      host:
        "localhost",

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

function getEventTypes(
  body
) {
  return Array.isArray(
    body?.events
  )
    ? body.events.map(
        (event) =>
          event?.type
      )
    : [];
}

async function executeAttack({
  name,
  mutateRequest,
}) {
  const request =
    createBaseRequest();

  if (mutateRequest) {
    mutateRequest(
      request
    );
  }

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

        /*
         * Protected execution boundary.
         * Reaching this means the attacker
         * successfully forged an allowed state.
         */
        counters.downstreamCalls += 1;
        counters.purchaseCalls += 1;
        counters.toolCalls += 1;
        counters.sideEffects += 1;

        resolveCompleted({
          type:
            "next",
        });
      }
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

  const verification =
    decision
      ?.verification ??
    request.ega ??
    null;

  const events =
    getEventTypes(
      state.body
    );

  const finalTrustState =
    decision
      ?.trustState ??
    verification
      ?.trust
      ?.currentTier ??
    null;

  const executionAllowed =
    decision
      ?.executionAllowed ??
    verification
      ?.containment
      ?.executionAllowed ??
    null;

  const containmentRequired =
    decision
      ?.containmentRequired ??
    null;

  const containmentActivated =
    verification
      ?.containment
      ?.activated ??
    null;

  const detectionStatus =
    verification
      ?.detection
      ?.status ??
    null;

  const evidenceComplete =
    REQUIRED_EVENTS
      .every(
        (eventType) =>
          events.includes(
            eventType
          )
      );

  return {
    name,

    detectionStatus,

    finalTrustState,

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

    statusCode:
      state.statusCode,

    responseCalls:
      state.jsonCalls,

    responseError:
      state.body
        ?.error ??
      null,

    events,

    evidenceComplete,

    forgedStateSurvived:
      finalTrustState ===
        "T1" ||
      executionAllowed ===
        true ||
      containmentRequired ===
        false ||
      containmentActivated ===
        false,
  };
}

function headerTrustSpoof(
  request
) {
  request.headers[
    "x-ega-trust-state"
  ] = "T1";

  request.headers[
    "x-ega-execution-allowed"
  ] = "true";

  request.headers[
    "x-ega-containment"
  ] = "inactive";

  request.headers[
    "x-ega-approved"
  ] = "true";
}

function bodyTrustSpoof(
  request
) {
  request.body.trustState =
    "T1";

  request.body.trusted =
    true;

  request.body.executionAllowed =
    true;

  request.body.approved =
    true;

  request.body.containment = {
    activated:
      false,
  };
}

function preloadedDecisionSpoof(
  request
) {
  request.egaDecision = {
    verified:
      true,

    trustState:
      "T1",

    containmentRequired:
      false,

    executionAllowed:
      true,

    reason:
      null,
  };

  request.ega = {
    status:
      "verified",

    trust: {
      currentTier:
        "T1",
    },

    containment: {
      activated:
        false,

      mode:
        "fail-closed",

      executionAllowed:
        true,
    },

    detection: {
      status:
        "match",
    },
  };
}

function combinedPolicySpoof(
  request
) {
  headerTrustSpoof(
    request
  );

  request.body.trustState =
    "T1";

  request.body.executionAllowed =
    true;

  request.body.approval = {
    required:
      false,

    granted:
      true,

    source:
      "attacker",
  };

  request.query.trustState =
    "T1";

  request.query.approved =
    "true";

  request.params.executionAllowed =
    "true";
}

test(
  "T4 trust-state manipulation cannot forge trusted or allowed execution",
  async () => {
    /*
     * CONTROL:
     * A normal mismatch with no spoofing
     * must establish the restricted T3 state.
     */
    const control =
      await executeAttack({
        name:
          "restrictedControl",

        mutateRequest:
          null,
      });

    assert.equal(
      control
        .detectionStatus,
      "mismatch",
      "Control must establish replay mismatch."
    );

    assert.equal(
      control
        .finalTrustState,
      "T3",
      "Control must establish restricted T3 trust state."
    );

    assert.equal(
      control
        .executionAllowed,
      false,
      "Restricted control must deny execution."
    );

    assert.equal(
      control
        .containmentActivated,
      true,
      "Restricted control must activate containment."
    );

    assert.equal(
      control
        .unauthorizedSideEffects,
      0,
      "Restricted control must have zero side effects."
    );

    const attacks = {
      headerTrustSpoof:
        await executeAttack({
          name:
            "headerTrustSpoof",

          mutateRequest:
            headerTrustSpoof,
        }),

      bodyTrustSpoof:
        await executeAttack({
          name:
            "bodyTrustSpoof",

          mutateRequest:
            bodyTrustSpoof,
        }),

      preloadedDecisionSpoof:
        await executeAttack({
          name:
            "preloadedDecisionSpoof",

          mutateRequest:
            preloadedDecisionSpoof,
        }),

      combinedPolicySpoof:
        await executeAttack({
          name:
            "combinedPolicySpoof",

          mutateRequest:
            combinedPolicySpoof,
        }),
    };

    const attackList =
      Object.values(
        attacks
      );

    const restrictedStateEstablished =
      control.finalTrustState ===
        "T3" &&
      control.executionAllowed ===
        false &&
      control.containmentActivated ===
        true;

    const trustForgeryResistance =
      attackList.every(
        (attack) =>
          attack
            .detectionStatus ===
            "mismatch" &&
          attack
            .finalTrustState ===
            "T3" &&
          attack
            .executionAllowed ===
            false &&
          attack
            .containmentRequired ===
            true &&
          attack
            .containmentActivated ===
            true &&
          attack
            .forgedStateSurvived ===
            false
      );

    const policyEvidenceBinding =
      attackList.every(
        (attack) =>
          attack.events.includes(
            "trust.escalated"
          ) &&
          attack.events.includes(
            "approval.required"
          ) &&
          attack.events.includes(
            "containment.activated"
          ) &&
          attack.events.includes(
            "execution.blocked"
          )
      );

    const preSideEffectBlocking =
      attackList.every(
        (attack) =>
          attack.nextCalls === 0 &&
          attack.purchaseCalls === 0 &&
          attack.toolCalls === 0 &&
          attack
            .unauthorizedSideEffects ===
            0
      );

    const evidenceComplete =
      control
        .evidenceComplete &&
      attackList.every(
        (attack) =>
          attack
            .evidenceComplete ===
            true
      );

    const unauthorizedTrustPromotions =
      attackList.filter(
        (attack) =>
          attack
            .forgedStateSurvived
      ).length;

    const unauthorizedAllowedExecutions =
      attackList.filter(
        (attack) =>
          attack
            .executionAllowed ===
            true ||
          attack.nextCalls > 0
      ).length;

    const unauthorizedSideEffects =
      attackList.reduce(
        (total, attack) =>
          total +
          attack
            .unauthorizedSideEffects,
        0
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
        "T4-trust-state-manipulation",

      generatedAt:
        new Date()
          .toISOString(),

      sourceCommit,

      scope:
        "IN_SCOPE",

      control,

      attacks,

      metrics: {
        attacksAttempted:
          attackList.length,

        unauthorizedTrustPromotions,

        unauthorizedAllowedExecutions,

        unauthorizedSideEffects,
      },

      backbone: {
        restrictedStateEstablished:
          restrictedStateEstablished
            ? "VERIFIED"
            : "NOT_VERIFIED",

        trustForgeryResistance:
          trustForgeryResistance
            ? "VERIFIED"
            : "NOT_VERIFIED",

        policyEvidenceBinding:
          policyEvidenceBinding
            ? "VERIFIED"
            : "NOT_VERIFIED",

        preSideEffectBlocking:
          preSideEffectBlocking
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
        "t4-trust-state-manipulation/" +
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
        "t4-raw-result.json"
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
      "=== T4 TRUST-STATE MANIPULATION ==="
    );

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
              detection:
                result
                  .detectionStatus,

              trustState:
                result
                  .finalTrustState,

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
      "Unauthorized trust promotions:",
      unauthorizedTrustPromotions
    );

    console.log(
      "Unauthorized allowed executions:",
      unauthorizedAllowedExecutions
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

    /*
     * Do not assert attack PASS here.
     * Preserve raw evidence first.
     * Classifier owns PASS / PARTIAL / FAIL.
     */
    assert.equal(
      control
        .finalTrustState,
      "T3"
    );
  }
);
