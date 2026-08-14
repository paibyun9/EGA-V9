"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const {
  ega,
} = require(
  "../../../packages/sdk-ts/dist/index.js"
);

const INVALID_ROOT =
  "0".repeat(64);

const WORKFLOW = {
  steps: [
    {
      action: "validate-cart",
      tool: "cart-validator",
      input: {
        cartId:
          "t1-persistence-cart",
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

function clone(value) {
  return structuredClone(value);
}

function createRequest({
  workflow = WORKFLOW,
  mismatch = true,
} = {}) {
  return {
    method: "POST",
    path: "/t1/persistence",
    originalUrl:
      "/t1/persistence",
    url: "/t1/persistence",

    body: {
      workflow:
        clone(workflow),
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",

      ...(mismatch
        ? {
            "x-ega-expected-replay-root":
              INVALID_ROOT,
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
  };

  let resolveCompleted;

  const completed =
    new Promise(
      (resolve) => {
        resolveCompleted =
          resolve;
      }
    );

  const response = {
    statusCode: 200,

    setHeader() {},

    status(code) {
      state.statusCode = code;
      response.statusCode = code;

      return response;
    },

    json(body) {
      state.jsonCalls += 1;
      state.body = body;

      resolveCompleted({
        type: "response",
      });
    },
  };

  return {
    state,
    response,
    completed,
    resolveCompleted,
  };
}

async function runGuard({
  request,
}) {
  const counters = {
    nextCalls: 0,
    sideEffects: 0,
    toolCalls: 0,
    purchaseCalls: 0,
  };

  const {
    state,
    response,
    completed,
    resolveCompleted,
  } = createResponse();

  const middleware =
    ega.guard({
      mode: "fail-closed",
      statusCode: 409,
    });

  await Promise.resolve(
    middleware(
      request,
      response,
      (error) => {
        counters.nextCalls += 1;

        if (error) {
          resolveCompleted({
            type: "error",
            error,
          });

          throw error;
        }

        /*
         * This represents the protected
         * business execution boundary.
         */
        counters.sideEffects += 1;
        counters.toolCalls += 1;
        counters.purchaseCalls += 1;

        resolveCompleted({
          type: "next",
        });
      }
    )
  );

  /*
   * Wait for either the containment
   * response or successful next().
   */
  await Promise.race([
    completed,

    new Promise(
      (_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Persistence probe timed out."
              )
            ),
          2000
        );
      }
    ),
  ]);

  return {
    counters,
    state,

    decision:
      request.egaDecision ??
      null,

    containment:
      request.ega
        ?.containment ??
      request.egaDecision
        ?.verification
        ?.containment ??
      null,
  };
}

function alternateWorkflow() {
  const workflow =
    clone(WORKFLOW);

  workflow.steps[1] = {
    action: "purchase",
    tool:
      "alternate-payment-provider",

    input: {
      amount: 125,
      currency: "USD",
      reason:
        "post-containment alternate capability probe",
    },
  };

  return workflow;
}

function nestedWorkflow() {
  const workflow =
    clone(WORKFLOW);

  workflow.steps.push({
    action:
      "nested-execution",

    tool:
      "nested-runtime",

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

test(
  "T1 strong post-containment persistence probe",
  async () => {
    /*
     * Phase 1:
     * Establish real containment.
     */
    const containedRequest =
      createRequest({
        mismatch: true,
      });

    const initial =
      await runGuard({
        request:
          containedRequest,
      });

    assert.equal(
      initial.decision
        ?.containmentRequired,
      true,
      "Initial request must be contained."
    );

    assert.equal(
      initial.decision
        ?.executionAllowed,
      false,
      "Initial contained request must deny execution."
    );

    assert.equal(
      initial.counters.sideEffects,
      0,
      "Initial containment must prevent side effects."
    );

    const initialQuarantineId =
      initial.containment
        ?.quarantineId ??
      null;

    /*
     * Phase 2A:
     * SAME REQUEST OBJECT.
     *
     * Remove the mismatch trigger after
     * containment and attempt to resume.
     *
     * This asks whether restriction is
     * persistent or whether the request
     * is simply evaluated again as clean.
     */
    delete containedRequest.headers[
      "x-ega-expected-replay-root"
    ];

    const sameRequestResume =
      await runGuard({
        request:
          containedRequest,
      });

    /*
     * Phase 2B:
     * Fresh request carrying the same
     * underlying workflow, but no
     * replay mismatch trigger.
     */
    const freshRetry =
      await runGuard({
        request:
          createRequest({
            mismatch: false,
          }),
      });

    /*
     * Phase 2C:
     * Fresh alternate capability path,
     * again without the original
     * mismatch trigger.
     */
    const alternateCapability =
      await runGuard({
        request:
          createRequest({
            workflow:
              alternateWorkflow(),

            mismatch: false,
          }),
      });

    /*
     * Phase 2D:
     * Nested continuation attempt,
     * without replay mismatch header.
     */
    const nestedContinuation =
      await runGuard({
        request:
          createRequest({
            workflow:
              nestedWorkflow(),

            mismatch: false,
          }),
      });

    const probes = {
      sameRequestResume,
      freshRetry,
      alternateCapability,
      nestedContinuation,
    };

    const normalized =
      Object.fromEntries(
        Object.entries(
          probes
        ).map(
          ([
            name,
            result,
          ]) => [
            name,
            {
              executionAllowed:
                result.decision
                  ?.executionAllowed ??
                null,

              containmentRequired:
                result.decision
                  ?.containmentRequired ??
                null,

              nextCalls:
                result.counters
                  .nextCalls,

              sideEffects:
                result.counters
                  .sideEffects,

              toolCalls:
                result.counters
                  .toolCalls,

              purchaseCalls:
                result.counters
                  .purchaseCalls,

              quarantineId:
                result.containment
                  ?.quarantineId ??
                null,
            },
          ]
        )
      );

    const executionResumes =
      Object.values(
        normalized
      ).filter(
        (result) =>
          result.nextCalls > 0 ||
          result.sideEffects > 0
      ).length;

    const capabilityReacquisitions =
      Object.values(
        normalized
      ).filter(
        (result) =>
          result.toolCalls > 0 ||
          result.purchaseCalls > 0
      ).length;

    const unauthorizedSideEffects =
      Object.values(
        normalized
      ).reduce(
        (total, result) =>
          total +
          result.sideEffects,
        0
      );

    const persistentRestrictionVerified =
      Object.values(
        normalized
      ).every(
        (result) =>
          result.executionAllowed ===
            false &&
          result.nextCalls === 0 &&
          result.sideEffects === 0
      );

    const result = {
      testId:
        "T1-strong-post-containment-persistence",

      generatedAt:
        new Date().toISOString(),

      scope:
        "IN_SCOPE_DIAGNOSTIC",

      initialContainment: {
        containmentRequired:
          initial.decision
            ?.containmentRequired ??
          null,

        executionAllowed:
          initial.decision
            ?.executionAllowed ??
          null,

        sideEffects:
          initial.counters
            .sideEffects,

        quarantineId:
          initialQuarantineId,
      },

      probes:
        normalized,

      metrics: {
        executionResumes,

        capabilityReacquisitions,

        unauthorizedSideEffects,
      },

      strongContainmentPersistence:
        persistentRestrictionVerified
          ? "VERIFIED"
          : "NOT_VERIFIED",

      interpretation:
        persistentRestrictionVerified
          ? (
              "Previously contained execution remained denied after the original mismatch trigger was removed."
            )
          : (
              "The tested runtime did not demonstrate persistent denial after the original mismatch trigger was removed. This does not invalidate fail-closed mismatch blocking; it means cross-attempt containment persistence is not established by this runtime path."
            ),
    };

    const evidencePath =
      path.resolve(
        process.cwd(),
        "security-tests/adversarial/" +
        "t1-containment-escape-resume/" +
        "evidence/" +
        "t1-strong-persistence-result.json"
      );

    fs.writeFileSync(
      evidencePath,
      `${JSON.stringify(
        result,
        null,
        2
      )}\n`,
      "utf8"
    );

    console.log();
    console.log(
      "=== T1 STRONG POST-CONTAINMENT PERSISTENCE ==="
    );

    console.table(
      normalized
    );

    console.log();

    console.log(
      "Initial quarantine ID:",
      initialQuarantineId
    );

    console.log(
      "Execution resumes:",
      executionResumes
    );

    console.log(
      "Capability reacquisitions:",
      capabilityReacquisitions
    );

    console.log(
      "Unauthorized side effects:",
      unauthorizedSideEffects
    );

    console.log(
      "Strong containment persistence:",
      result
        .strongContainmentPersistence
    );

    console.log(
      "Evidence:",
      evidencePath
    );

    /*
     * IMPORTANT:
     *
     * Do NOT force this diagnostic probe
     * itself to fail the Node test process.
     *
     * The point is to measure whether the
     * capability currently exists, not to
     * assume it exists.
     */
    assert.equal(
      initial.counters.sideEffects,
      0
    );
  }
);
