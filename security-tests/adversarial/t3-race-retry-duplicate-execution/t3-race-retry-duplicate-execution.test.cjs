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
          "T3-ORDER-001",
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

function clone(value) {
  return structuredClone(
    value
  );
}

function createBaseRequest({
  approvedReplayRoot,
} = {}) {
  return {
    method: "POST",

    path:
      "/t3/purchase",

    originalUrl:
      "/t3/purchase",

    url:
      "/t3/purchase",

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

      ...(approvedReplayRoot
        ? {
            "x-ega-expected-replay-root":
              approvedReplayRoot,
          }
        : {}),
    },
  };
}

async function captureApprovedReplayRoot() {
  const request =
    createBaseRequest();

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
          "Approval capture unexpectedly blocked: " +
          JSON.stringify(body)
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
            "Approval capture unexpectedly contained: " +
            JSON.stringify(
              decision
            )
          )
        );
      },
    });

  const timeout =
    setTimeout(
      () =>
        rejectCompleted(
          new Error(
            "Approval capture timed out."
          )
        ),
      2000
    );

  try {
    middleware(
      request,
      response,
      (error) => {
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
      "EGA guard did not produce approved replay root."
    );
  }

  if (
    request.egaDecision
      ?.executionAllowed !== true
  ) {
    throw new Error(
      "Approval capture was not allowed."
    );
  }

  return replayRoot;
}

function createResponse() {
  const state = {
    statusCode: 200,
    jsonCalls: 0,
    body: undefined,
  };

  const response = {
    statusCode: 200,

    setHeader() {},

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
    },
  };

  return {
    state,
    response,
  };
}

function createLedger() {
  return {
    protectedBoundaryCalls: 0,
    purchaseExecutions: 0,
    toolExecutions: 0,
    sideEffects: 0,
  };
}

function summarizeLedger(
  ledger
) {
  const totalSideEffects =
    ledger.sideEffects;

  return {
    protectedBoundaryCalls:
      ledger
        .protectedBoundaryCalls,

    purchaseExecutions:
      ledger
        .purchaseExecutions,

    toolExecutions:
      ledger
        .toolExecutions,

    totalSideEffects,

    duplicateSideEffects:
      Math.max(
        0,
        totalSideEffects - 1
      ),

    duplicatePurchaseExecutions:
      Math.max(
        0,
        ledger.purchaseExecutions - 1
      ),

    duplicateToolExecutions:
      Math.max(
        0,
        ledger.toolExecutions - 1
      ),
  };
}

async function executeOne({
  approvedReplayRoot,
  ledger,
  label,
  sideEffectDelayMs = 0,
}) {
  const request =
    createBaseRequest({
      approvedReplayRoot,
    });

  const {
    state,
    response,
  } = createResponse();

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
      statusCode:
        409,
    });

  const timeout =
    setTimeout(
      () =>
        rejectCompleted(
          new Error(
            `${label}: execution timed out`
          )
        ),
      3000
    );

  try {
    middleware(
      request,
      response,
      (error) => {
        if (error) {
          rejectCompleted(
            error
          );
          return;
        }

        /*
         * Protected execution boundary.
         *
         * NO dedupe lock is intentionally
         * added here.
         */
        ledger
          .protectedBoundaryCalls +=
          1;

        const finish =
          () => {
            ledger
              .purchaseExecutions +=
              1;

            ledger
              .toolExecutions +=
              1;

            ledger
              .sideEffects +=
              1;

            resolveCompleted({
              status:
                "executed",
            });
          };

        if (
          sideEffectDelayMs > 0
        ) {
          setTimeout(
            finish,
            sideEffectDelayMs
          );
        } else {
          finish();
        }
      }
    );

    /*
     * A containment response may happen
     * synchronously without next().
     */
    if (
      state.jsonCalls > 0
    ) {
      resolveCompleted({
        status:
          "blocked",
      });
    }

    const outcome =
      await completed;

    return {
      label,

      outcome:
        outcome.status,

      executionAllowed:
        request.egaDecision
          ?.executionAllowed ??
        null,

      containmentRequired:
        request.egaDecision
          ?.containmentRequired ??
        null,

      replayRoot:
        request.ega
          ?.replayRoot ??
        request.egaDecision
          ?.verification
          ?.replayRoot ??
        null,

      statusCode:
        state.statusCode,

      responseCalls:
        state.jsonCalls,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function runConcurrentDuplicates({
  approvedReplayRoot,
}) {
  const ledger =
    createLedger();

  const requestCount = 10;

  const executions =
    Array.from(
      {
        length:
          requestCount,
      },
      (_, index) =>
        executeOne({
          approvedReplayRoot,
          ledger,
          label:
            `race-${index + 1}`,
          sideEffectDelayMs:
            25,
        })
    );

  const attempts =
    await Promise.all(
      executions
    );

  return {
    requestCount,
    attempts,
    ...summarizeLedger(
      ledger
    ),
  };
}

async function runTimeoutRetry({
  approvedReplayRoot,
}) {
  const ledger =
    createLedger();

  /*
   * First request reaches the execution
   * boundary but its side effect is
   * intentionally delayed.
   *
   * The client behaves as though it timed
   * out and retries the exact same logical
   * execution before the first completes.
   */
  const first =
    executeOne({
      approvedReplayRoot,
      ledger,
      label:
        "timeout-original",
      sideEffectDelayMs:
        60,
    });

  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        5
      )
  );

  const retry =
    executeOne({
      approvedReplayRoot,
      ledger,
      label:
        "timeout-retry",
      sideEffectDelayMs:
        10,
    });

  const attempts =
    await Promise.all([
      first,
      retry,
    ]);

  return {
    requestCount: 2,
    attempts,
    ...summarizeLedger(
      ledger
    ),
  };
}

async function runRepeatedDuplicates({
  approvedReplayRoot,
}) {
  const ledger =
    createLedger();

  const attempts = [];

  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    attempts.push(
      await executeOne({
        approvedReplayRoot,
        ledger,
        label:
          `duplicate-${index + 1}`,
      })
    );
  }

  return {
    requestCount: 5,
    attempts,
    ...summarizeLedger(
      ledger
    ),
  };
}

test(
  "T3 race retry duplicate execution produces no duplicate side effect",
  async () => {
    const approvedReplayRoot =
      await captureApprovedReplayRoot();

    /*
     * CONTROL
     */
    const controlLedger =
      createLedger();

    const controlAttempt =
      await executeOne({
        approvedReplayRoot,
        ledger:
          controlLedger,
        label:
          "control",
      });

    const control =
      {
        attempt:
          controlAttempt,

        ...summarizeLedger(
          controlLedger
        ),
      };

    assert.equal(
      control.totalSideEffects,
      1,
      "Control must prove one legitimate side effect is reachable."
    );

    const concurrentDuplicates =
      await runConcurrentDuplicates({
        approvedReplayRoot,
      });

    const timeoutRetry =
      await runTimeoutRetry({
        approvedReplayRoot,
      });

    const repeatedDuplicates =
      await runRepeatedDuplicates({
        approvedReplayRoot,
      });

    const attacks = {
      concurrentDuplicates,
      timeoutRetry,
      repeatedDuplicates,
    };

    const attackList =
      Object.values(
        attacks
      );

    const allReplayRootsBound =
      attackList.every(
        (attack) =>
          attack.attempts.every(
            (attempt) =>
              attempt.replayRoot ===
              approvedReplayRoot
          )
      );

    const totalDuplicateSideEffects =
      attackList.reduce(
        (total, attack) =>
          total +
          attack
            .duplicateSideEffects,
        0
      );

    const totalDuplicatePurchaseExecutions =
      attackList.reduce(
        (total, attack) =>
          total +
          attack
            .duplicatePurchaseExecutions,
        0
      );

    const totalDuplicateToolExecutions =
      attackList.reduce(
        (total, attack) =>
          total +
          attack
            .duplicateToolExecutions,
        0
      );

    const raceSafe =
      concurrentDuplicates
        .duplicateSideEffects ===
      0;

    const retrySafe =
      timeoutRetry
        .duplicateSideEffects ===
      0;

    const repeatedSafe =
      repeatedDuplicates
        .duplicateSideEffects ===
      0;

    const duplicateSuppression =
      raceSafe &&
      retrySafe &&
      repeatedSafe;

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
        "T3-race-retry-duplicate-execution",

      generatedAt:
        new Date()
          .toISOString(),

      sourceCommit,

      scope:
        "IN_SCOPE",

      approvedIntent: {
        replayRoot:
          approvedReplayRoot,

        workflow:
          APPROVED_WORKFLOW,
      },

      control,

      attacks,

      metrics: {
        attackScenarios:
          attackList.length,

        duplicateSideEffects:
          totalDuplicateSideEffects,

        duplicatePurchaseExecutions:
          totalDuplicatePurchaseExecutions,

        duplicateToolExecutions:
          totalDuplicateToolExecutions,
      },

      backbone: {
        singleExecutionBinding:
          allReplayRootsBound
            ? "VERIFIED"
            : "NOT_VERIFIED",

        duplicateSuppression:
          duplicateSuppression
            ? "VERIFIED"
            : "NOT_VERIFIED",

        raceSafety:
          raceSafe
            ? "VERIFIED"
            : "NOT_VERIFIED",

        retrySafety:
          retrySafe
            ? "VERIFIED"
            : "NOT_VERIFIED",

        repeatedDeliverySafety:
          repeatedSafe
            ? "VERIFIED"
            : "NOT_VERIFIED",

        evidenceCompleteness:
          allReplayRootsBound
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
        "t3-race-retry-duplicate-execution/" +
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
        "t3-raw-result.json"
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
      "=== T3 RACE / RETRY / DUPLICATE EXECUTION ==="
    );

    console.log(
      "Approved replay root:",
      approvedReplayRoot
    );

    console.log();

    console.table({
      concurrentDuplicates: {
        requests:
          concurrentDuplicates
            .requestCount,

        totalSideEffects:
          concurrentDuplicates
            .totalSideEffects,

        duplicateSideEffects:
          concurrentDuplicates
            .duplicateSideEffects,
      },

      timeoutRetry: {
        requests:
          timeoutRetry
            .requestCount,

        totalSideEffects:
          timeoutRetry
            .totalSideEffects,

        duplicateSideEffects:
          timeoutRetry
            .duplicateSideEffects,
      },

      repeatedDuplicates: {
        requests:
          repeatedDuplicates
            .requestCount,

        totalSideEffects:
          repeatedDuplicates
            .totalSideEffects,

        duplicateSideEffects:
          repeatedDuplicates
            .duplicateSideEffects,
      },
    });

    console.log();

    console.log(
      "Duplicate side effects:",
      totalDuplicateSideEffects
    );

    console.log(
      "Duplicate purchase executions:",
      totalDuplicatePurchaseExecutions
    );

    console.log(
      "Duplicate tool executions:",
      totalDuplicateToolExecutions
    );

    console.log(
      "Raw evidence:",
      rawPath
    );

    /*
     * Do NOT assert zero duplicates here.
     *
     * The classifier owns PASS/FAIL.
     * This allows raw evidence to be
     * preserved even when the security
     * capability fails.
     */
    assert.equal(
      control.totalSideEffects,
      1
    );
  }
);
