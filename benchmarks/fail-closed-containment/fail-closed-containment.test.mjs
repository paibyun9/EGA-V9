import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * This test executes the locally built EGA V9 SDK.
 *
 * It does not reimplement:
 * - Replay Root calculation
 * - mismatch detection
 * - containment decisions
 * - event generation
 * - fail-closed blocking
 */
const { EGA } = require(
  "../../packages/sdk-ts/dist/index.js"
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "../..");

const evidenceDirectory = path.join(
  repositoryRoot,
  "publication",
  "evidence",
  "fail-closed-containment"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "fail-closed-containment-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "fail-closed-containment-evidence.md"
);

const APP_NAME = "ega-v9-fail-closed-evidence";
const POLICY_ID = "fail-closed-containment-v1";
const REPEAT_COUNT = 100;

/*
 * Approved workflow.
 */
const approvedBody = {
  workflowId: "WF-CONTAINMENT-001",
  action: "purchase",
  amount: 100,
  currency: "USD",
  approved: true,
  steps: [
    {
      sequence: 1,
      action: "catalog.search",
      item: "laptop"
    },
    {
      sequence: 2,
      action: "catalog.select",
      productId: "LP-001",
      quantity: 1
    },
    {
      sequence: 3,
      action: "commerce.checkout",
      approved: true
    }
  ]
};

/*
 * Divergent workflow.
 *
 * One unauthorized execution step is inserted into the
 * previously approved workflow.
 */
const divergentBody = structuredClone(approvedBody);

divergentBody.steps.splice(2, 0, {
  sequence: 2.5,
  action: "external.transfer",
  unauthorized: true,
  target: "unapproved-endpoint"
});

function createApprovedEnvelope(body) {
  return {
    appName: APP_NAME,
    method: "POST",
    path: "/purchase",
    body,
    query: null,
    params: null
  };
}

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let responseBody;
  let jsonCallCount = 0;
  let statusCallCount = 0;

  return {
    setHeader(name, value) {
      headers[String(name).toLowerCase()] =
        String(value);
    },

    status(code) {
      statusCode = code;
      statusCallCount += 1;
      return this;
    },

    json(body) {
      responseBody = body;
      jsonCallCount += 1;
      return this;
    },

    snapshot() {
      return {
        headers: { ...headers },
        statusCode,
        body: responseBody,
        jsonCallCount,
        statusCallCount
      };
    }
  };
}

function countEvents(events, eventType) {
  return events.filter(
    (event) => event.type === eventType
  ).length;
}

function runScenario({
  body,
  expectedReplayRoot,
  failClosed,
  attackType = "none"
}) {
  const ega = EGA.init({
    appName: APP_NAME,
    telemetry: false,
    failClosed,
    policyId: POLICY_ID,
    approvalThreshold: 70
  });

  const req = {
    method: "POST",
    originalUrl: "/purchase",
    body: structuredClone(body),
    query: null,
    params: null,
    headers: {
      host: "localhost",
      "user-agent":
        "ega-v9-fail-closed-evidence",

      "x-ega-expected-replay-root":
        expectedReplayRoot,

      "x-ega-attack-type":
        attackType
    }
  };

  const res = createMockResponse();

  let nextCalled = false;
  let nextCallCount = 0;
  let nextError;

  const next = (error) => {
    nextCalled = true;
    nextCallCount += 1;
    nextError = error;
  };

  ega.guard()(req, res, next);

  const events = ega.events();

  return {
    context: req.ega,
    response: res.snapshot(),
    nextCalled,
    nextCallCount,
    nextError,
    events,

    eventCounts: {
      "workflow.verified":
        countEvents(events, "workflow.verified"),

      "hash.verified":
        countEvents(events, "hash.verified"),

      "replay.mismatch":
        countEvents(events, "replay.mismatch"),

      "mutation.detected":
        countEvents(events, "mutation.detected"),

      "quarantine.created":
        countEvents(events, "quarantine.created"),

      "containment.activated":
        countEvents(events, "containment.activated"),

      "execution.blocked":
        countEvents(events, "execution.blocked")
    }
  };
}

function summarizeRun(run) {
  return {
    detectionStatus:
      run.context?.detection.status,

    containmentActivated:
      run.context?.containment.activated,

    containmentMode:
      run.context?.containment.mode,

    containmentReason:
      run.context?.containment.reason,

    quarantineId:
      run.context?.containment.quarantineId,

    executionAllowed:
      run.context?.containment.executionAllowed,

    contextStatus:
      run.context?.status,

    trustTier:
      run.context?.trust.currentTier,

    riskScore:
      run.context?.trust.riskScore,

    nextCalled:
      run.nextCalled,

    nextCallCount:
      run.nextCallCount,

    statusCode:
      run.response.statusCode,

    responseError:
      run.response.body?.error,

    responseOk:
      run.response.body?.ok,

    jsonCallCount:
      run.response.jsonCallCount,

    statusCallCount:
      run.response.statusCallCount,

    responseHeaders:
      run.response.headers,

    eventCounts:
      run.eventCounts
  };
}

function totalEvents(runs, eventType) {
  return runs.reduce(
    (total, run) =>
      total + run.eventCounts[eventType],
    0
  );
}

function countMatchingRuns(runs, predicate) {
  return runs.filter(predicate).length;
}

function shortenRoot(root) {
  return `${root.slice(0, 12)}...${root.slice(-12)}`;
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Fail-Closed Containment Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions per scenario: ${evidence.repeatCountPerScenario}
- Total executions: ${evidence.totalExecutions}
- SDK entry point: \`${evidence.sdkEntryPoint}\`

## Results

| Scenario | Detection | Mode | Containment | Execution allowed | next() | HTTP | Result |
|---|---:|---:|---:|---:|---:|---:|---:|
| Normal fail-closed | ${evidence.normal.observed.detectionStatus} | ${evidence.normal.observed.containmentMode} | ${evidence.normal.observed.containmentActivated} | ${evidence.normal.observed.executionAllowed} | ${evidence.normal.observed.nextCalled} | ${evidence.normal.observed.statusCode} | ${evidence.normal.pass ? "PASS" : "FAIL"} |
| Mismatch fail-closed | ${evidence.failClosedMismatch.observed.detectionStatus} | ${evidence.failClosedMismatch.observed.containmentMode} | ${evidence.failClosedMismatch.observed.containmentActivated} | ${evidence.failClosedMismatch.observed.executionAllowed} | ${evidence.failClosedMismatch.observed.nextCalled} | ${evidence.failClosedMismatch.observed.statusCode} | ${evidence.failClosedMismatch.pass ? "PASS" : "FAIL"} |
| Mismatch observe | ${evidence.observeMismatch.observed.detectionStatus} | ${evidence.observeMismatch.observed.containmentMode} | ${evidence.observeMismatch.observed.containmentActivated} | ${evidence.observeMismatch.observed.executionAllowed} | ${evidence.observeMismatch.observed.nextCalled} | ${evidence.observeMismatch.observed.statusCode} | ${evidence.observeMismatch.pass ? "PASS" : "FAIL"} |

## Containment Event Results

| Event | Normal fail-closed | Mismatch fail-closed | Mismatch observe |
|---|---:|---:|---:|
| \`replay.mismatch\` | ${evidence.normal.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} | ${evidence.failClosedMismatch.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} | ${evidence.observeMismatch.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} |
| \`quarantine.created\` | ${evidence.normal.eventTotals["quarantine.created"]}/${evidence.repeatCountPerScenario} | ${evidence.failClosedMismatch.eventTotals["quarantine.created"]}/${evidence.repeatCountPerScenario} | ${evidence.observeMismatch.eventTotals["quarantine.created"]}/${evidence.repeatCountPerScenario} |
| \`containment.activated\` | ${evidence.normal.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} | ${evidence.failClosedMismatch.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} | ${evidence.observeMismatch.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} |
| \`execution.blocked\` | ${evidence.normal.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} | ${evidence.failClosedMismatch.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} | ${evidence.observeMismatch.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} |

## Replay Roots

- Approved Replay Root: \`${evidence.replayRoots.approved}\`
- Fail-closed mismatch Replay Root: \`${evidence.replayRoots.failClosedMismatchActual}\`
- Observe mismatch Replay Root: \`${evidence.replayRoots.observeMismatchActual}\`

## Fail-Closed Response

- HTTP status: \`${evidence.failClosedMismatch.observed.statusCode}\`
- Error code: \`${evidence.failClosedMismatch.observed.responseError}\`
- Containment mode: \`${evidence.failClosedMismatch.observed.containmentMode}\`
- Execution allowed: \`${evidence.failClosedMismatch.observed.executionAllowed}\`
- next() called: \`${evidence.failClosedMismatch.observed.nextCalled}\`

## Assertions

| Assertion | Result |
|---|---:|
${Object.entries(evidence.assertions)
  .map(
    ([name, value]) =>
      `| \`${name}\` | ${value ? "PASS" : "FAIL"} |`
  )
  .join("\n")}

## Final Status

**${evidence.finalStatus}**

This evidence verifies that Replay Root mismatch activates
containment in both fail-closed and observe modes, while only
fail-closed mode prevents downstream execution and records an
\`execution.blocked\` event.

Remote infrastructure, operating-system, network, and model-level
containment are outside the scope of this test.
`;
}

async function writeEvidence(evidence) {
  await mkdir(evidenceDirectory, {
    recursive: true
  });

  await writeFile(
    jsonEvidencePath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );

  await writeFile(
    markdownEvidencePath,
    createMarkdownEvidence(evidence),
    "utf8"
  );
}

test(
  "Fail-Closed Containment evidence: mismatches are blocked while normal and observe-mode executions continue",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported from the built SDK"
    );

    /*
     * Produce the approved Replay Root through the real SDK.
     */
    const rootCalculator = EGA.init({
      appName: APP_NAME,
      telemetry: false,
      failClosed: true,
      policyId: POLICY_ID
    });

    const approvedReplayRoot =
      rootCalculator.replayRoot(
        createApprovedEnvelope(approvedBody)
      );

    const normalRuns = [];
    const failClosedMismatchRuns = [];
    const observeMismatchRuns = [];

    /*
     * Execute each scenario 100 times.
     */
    for (
      let index = 0;
      index < REPEAT_COUNT;
      index += 1
    ) {
      normalRuns.push(
        runScenario({
          body: approvedBody,
          expectedReplayRoot:
            approvedReplayRoot,
          failClosed: true
        })
      );

      failClosedMismatchRuns.push(
        runScenario({
          body: divergentBody,
          expectedReplayRoot:
            approvedReplayRoot,
          failClosed: true,
          attackType:
            "unauthorized-tool-invocation"
        })
      );

      observeMismatchRuns.push(
        runScenario({
          body: divergentBody,
          expectedReplayRoot:
            approvedReplayRoot,
          failClosed: false,
          attackType:
            "unauthorized-tool-invocation"
        })
      );
    }

    /*
     * Scenario 1:
     * Normal workflow in fail-closed mode must continue.
     */
    const normalPassCount =
      countMatchingRuns(
        normalRuns,
        (run) =>
          run.context?.detection.status ===
            "match" &&
          run.context?.containment.activated ===
            false &&
          run.context?.containment.mode ===
            "fail-closed" &&
          run.context?.containment
            .executionAllowed === true &&
          run.context?.status ===
            "verified" &&
          run.nextCalled === true &&
          run.nextCallCount === 1 &&
          run.nextError === undefined &&
          run.response.statusCode === 200 &&
          run.response.jsonCallCount === 0 &&
          run.eventCounts[
            "execution.blocked"
          ] === 0
      );

    /*
     * Scenario 2:
     * Mismatch in fail-closed mode must be blocked.
     */
    const failClosedPassCount =
      countMatchingRuns(
        failClosedMismatchRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.containment.activated ===
            true &&
          run.context?.containment.mode ===
            "fail-closed" &&
          run.context?.containment
            .executionAllowed === false &&
          run.context?.status ===
            "contained" &&
          typeof run.context?.containment
            .quarantineId === "string" &&
          run.context.containment
            .quarantineId.startsWith("q_") &&
          run.nextCalled === false &&
          run.nextCallCount === 0 &&
          run.response.statusCode === 409 &&
          run.response.body?.ok === false &&
          run.response.body?.error ===
            "EGA_CONTAINMENT_ACTIVATED" &&
          run.response.jsonCallCount === 1 &&
          run.eventCounts[
            "replay.mismatch"
          ] === 1 &&
          run.eventCounts[
            "quarantine.created"
          ] === 1 &&
          run.eventCounts[
            "containment.activated"
          ] === 1 &&
          run.eventCounts[
            "execution.blocked"
          ] === 1
      );

    /*
     * Scenario 3:
     * Mismatch in observe mode must remain visible,
     * but downstream execution must continue.
     */
    const observePassCount =
      countMatchingRuns(
        observeMismatchRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.containment.activated ===
            true &&
          run.context?.containment.mode ===
            "observe" &&
          run.context?.containment
            .executionAllowed === true &&
          run.context?.status ===
            "contained" &&
          typeof run.context?.containment
            .quarantineId === "string" &&
          run.context.containment
            .quarantineId.startsWith("q_") &&
          run.nextCalled === true &&
          run.nextCallCount === 1 &&
          run.nextError === undefined &&
          run.response.statusCode === 200 &&
          run.response.jsonCallCount === 0 &&
          run.eventCounts[
            "replay.mismatch"
          ] === 1 &&
          run.eventCounts[
            "quarantine.created"
          ] === 1 &&
          run.eventCounts[
            "containment.activated"
          ] === 1 &&
          run.eventCounts[
            "execution.blocked"
          ] === 0
      );

    /*
     * Aggregate event counts.
     */
    const normalContainmentEvents =
      totalEvents(
        normalRuns,
        "containment.activated"
      );

    const normalBlockedEvents =
      totalEvents(
        normalRuns,
        "execution.blocked"
      );

    const failClosedReplayMismatchEvents =
      totalEvents(
        failClosedMismatchRuns,
        "replay.mismatch"
      );

    const failClosedQuarantineEvents =
      totalEvents(
        failClosedMismatchRuns,
        "quarantine.created"
      );

    const failClosedContainmentEvents =
      totalEvents(
        failClosedMismatchRuns,
        "containment.activated"
      );

    const failClosedBlockedEvents =
      totalEvents(
        failClosedMismatchRuns,
        "execution.blocked"
      );

    const observeReplayMismatchEvents =
      totalEvents(
        observeMismatchRuns,
        "replay.mismatch"
      );

    const observeQuarantineEvents =
      totalEvents(
        observeMismatchRuns,
        "quarantine.created"
      );

    const observeContainmentEvents =
      totalEvents(
        observeMismatchRuns,
        "containment.activated"
      );

    const observeBlockedEvents =
      totalEvents(
        observeMismatchRuns,
        "execution.blocked"
      );

    /*
     * Hard assertions.
     */
    assert.equal(
      normalPassCount,
      REPEAT_COUNT,
      "Normal workflows were not consistently allowed"
    );

    assert.equal(
      failClosedPassCount,
      REPEAT_COUNT,
      "Fail-closed mismatches were not consistently blocked"
    );

    assert.equal(
      observePassCount,
      REPEAT_COUNT,
      "Observe-mode mismatches were not consistently allowed"
    );

    assert.equal(
      normalContainmentEvents,
      0,
      "Normal workflows must not activate containment"
    );

    assert.equal(
      normalBlockedEvents,
      0,
      "Normal workflows must not create execution.blocked events"
    );

    assert.equal(
      failClosedReplayMismatchEvents,
      REPEAT_COUNT,
      "Fail-closed mismatches must record replay.mismatch"
    );

    assert.equal(
      failClosedQuarantineEvents,
      REPEAT_COUNT,
      "Fail-closed mismatches must create quarantine evidence"
    );

    assert.equal(
      failClosedContainmentEvents,
      REPEAT_COUNT,
      "Fail-closed mismatches must activate containment"
    );

    assert.equal(
      failClosedBlockedEvents,
      REPEAT_COUNT,
      "Fail-closed mismatches must record execution.blocked"
    );

    assert.equal(
      observeReplayMismatchEvents,
      REPEAT_COUNT,
      "Observe mismatches must still record replay.mismatch"
    );

    assert.equal(
      observeQuarantineEvents,
      REPEAT_COUNT,
      "Observe mismatches must still create quarantine evidence"
    );

    assert.equal(
      observeContainmentEvents,
      REPEAT_COUNT,
      "Observe mismatches must record containment activation"
    );

    assert.equal(
      observeBlockedEvents,
      0,
      "Observe mode must not record execution.blocked"
    );

    const failClosedActualRoots = [
      ...new Set(
        failClosedMismatchRuns.map(
          (run) =>
            run.context.detection.actualReplayRoot
        )
      )
    ];

    const observeActualRoots = [
      ...new Set(
        observeMismatchRuns.map(
          (run) =>
            run.context.detection.actualReplayRoot
        )
      )
    ];

    assert.equal(
      failClosedActualRoots.length,
      1,
      "Fail-closed divergent Replay Root was not stable"
    );

    assert.equal(
      observeActualRoots.length,
      1,
      "Observe divergent Replay Root was not stable"
    );

    assert.equal(
      failClosedActualRoots[0],
      observeActualRoots[0],
      "Containment mode changed the divergent Replay Root"
    );

    assert.notEqual(
      failClosedActualRoots[0],
      approvedReplayRoot,
      "Divergent Replay Root unexpectedly matched the approved root"
    );

    const normalSample =
      summarizeRun(normalRuns[0]);

    const failClosedSample =
      summarizeRun(
        failClosedMismatchRuns[0]
      );

    const observeSample =
      summarizeRun(observeMismatchRuns[0]);

    const assertions = {
      normalExecutionAllowed:
        normalPassCount === REPEAT_COUNT,

      normalDoesNotActivateContainment:
        normalContainmentEvents === 0,

      normalDoesNotRecordBlockedEvent:
        normalBlockedEvents === 0,

      failClosedMismatchDetected:
        failClosedReplayMismatchEvents ===
          REPEAT_COUNT,

      failClosedContainmentActivated:
        failClosedContainmentEvents ===
          REPEAT_COUNT,

      failClosedExecutionDisallowed:
        failClosedMismatchRuns.every(
          (run) =>
            run.context.containment
              .executionAllowed === false
        ),

      failClosedNextNotCalled:
        failClosedMismatchRuns.every(
          (run) => run.nextCalled === false
        ),

      failClosedReturns409:
        failClosedMismatchRuns.every(
          (run) =>
            run.response.statusCode === 409
        ),

      failClosedReturnsContainmentError:
        failClosedMismatchRuns.every(
          (run) =>
            run.response.body?.error ===
            "EGA_CONTAINMENT_ACTIVATED"
        ),

      failClosedCreatesQuarantine:
        failClosedQuarantineEvents ===
          REPEAT_COUNT,

      failClosedRecordsExecutionBlocked:
        failClosedBlockedEvents ===
          REPEAT_COUNT,

      observeMismatchDetected:
        observeReplayMismatchEvents ===
          REPEAT_COUNT,

      observeExecutionAllowed:
        observeMismatchRuns.every(
          (run) =>
            run.context.containment
              .executionAllowed === true
        ),

      observeNextCalled:
        observeMismatchRuns.every(
          (run) => run.nextCalled === true
        ),

      observeDoesNotRecordExecutionBlocked:
        observeBlockedEvents === 0,

      containmentModeDoesNotChangeReplayRoot:
        failClosedActualRoots[0] ===
          observeActualRoots[0]
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    const evidence = {
      schemaVersion:
        "ega-v9.fail-closed-containment-evidence.v1",

      testId: "FC-001",

      title:
        "Fail-Closed Containment and Downstream Execution Prevention",

      generatedAt:
        new Date().toISOString(),

      sdkEntryPoint:
        "packages/sdk-ts/dist/index.js",

      sdkApisUsed: [
        "EGA.init",
        "EGA.replayRoot",
        "EGA.guard",
        "EGA.events"
      ],

      repeatCountPerScenario:
        REPEAT_COUNT,

      totalExecutions:
        REPEAT_COUNT * 3,

      scope: {
        included: [
          "normal workflow execution allowance",
          "Replay Root mismatch containment activation",
          "fail-closed downstream execution prevention",
          "HTTP containment response",
          "quarantine creation",
          "containment event recording",
          "execution.blocked event recording",
          "observe-mode contrast"
        ],

        excluded: [
          "remote infrastructure isolation",
          "operating-system process termination",
          "network segmentation",
          "GPU or virtual-machine isolation",
          "model-level containment"
        ]
      },

      replayRoots: {
        approved:
          approvedReplayRoot,

        approvedDisplay:
          shortenRoot(approvedReplayRoot),

        failClosedMismatchActual:
          failClosedActualRoots[0],

        failClosedMismatchDisplay:
          shortenRoot(
            failClosedActualRoots[0]
          ),

        observeMismatchActual:
          observeActualRoots[0],

        observeMismatchDisplay:
          shortenRoot(
            observeActualRoots[0]
          )
      },

      normal: {
        scenario:
          "approved-workflow-fail-closed",

        expected: {
          detectionStatus: "match",
          containmentActivated: false,
          containmentMode: "fail-closed",
          executionAllowed: true,
          nextCalled: true,
          statusCode: 200,
          executionBlockedEvents: 0
        },

        observed:
          normalSample,

        passCount:
          normalPassCount,

        failCount:
          REPEAT_COUNT - normalPassCount,

        eventTotals: {
          "replay.mismatch":
            totalEvents(
              normalRuns,
              "replay.mismatch"
            ),

          "quarantine.created":
            totalEvents(
              normalRuns,
              "quarantine.created"
            ),

          "containment.activated":
            normalContainmentEvents,

          "execution.blocked":
            normalBlockedEvents
        },

        pass:
          normalPassCount === REPEAT_COUNT
      },

      failClosedMismatch: {
        scenario:
          "divergent-workflow-fail-closed",

        expected: {
          detectionStatus: "mismatch",
          containmentActivated: true,
          containmentMode: "fail-closed",
          executionAllowed: false,
          nextCalled: false,
          statusCode: 409,
          responseError:
            "EGA_CONTAINMENT_ACTIVATED",
          replayMismatchEvents: 100,
          quarantineEvents: 100,
          containmentEvents: 100,
          executionBlockedEvents: 100
        },

        observed:
          failClosedSample,

        passCount:
          failClosedPassCount,

        failCount:
          REPEAT_COUNT -
          failClosedPassCount,

        eventTotals: {
          "replay.mismatch":
            failClosedReplayMismatchEvents,

          "quarantine.created":
            failClosedQuarantineEvents,

          "containment.activated":
            failClosedContainmentEvents,

          "execution.blocked":
            failClosedBlockedEvents
        },

        pass:
          failClosedPassCount ===
          REPEAT_COUNT
      },

      observeMismatch: {
        scenario:
          "divergent-workflow-observe",

        expected: {
          detectionStatus: "mismatch",
          containmentActivated: true,
          containmentMode: "observe",
          executionAllowed: true,
          nextCalled: true,
          statusCode: 200,
          replayMismatchEvents: 100,
          quarantineEvents: 100,
          containmentEvents: 100,
          executionBlockedEvents: 0
        },

        observed:
          observeSample,

        passCount:
          observePassCount,

        failCount:
          REPEAT_COUNT -
          observePassCount,

        eventTotals: {
          "replay.mismatch":
            observeReplayMismatchEvents,

          "quarantine.created":
            observeQuarantineEvents,

          "containment.activated":
            observeContainmentEvents,

          "execution.blocked":
            observeBlockedEvents
        },

        pass:
          observePassCount ===
          REPEAT_COUNT
      },

      assertions,

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    console.log(
      "\n=== EGA V9 Fail-Closed Containment Evidence ==="
    );

    console.log(
      `Normal executions allowed: ${normalPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed mismatches blocked: ${failClosedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Observe mismatches continued: ${observePassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed containment events: ${failClosedContainmentEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed execution.blocked events: ${failClosedBlockedEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed quarantine events: ${failClosedQuarantineEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `Observe execution.blocked events: ${observeBlockedEvents}`
    );

    console.log(
      `Fail-closed HTTP 409 responses: ${
        failClosedMismatchRuns.filter(
          (run) =>
            run.response.statusCode === 409
        ).length
      }/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed next() calls: ${
        failClosedMismatchRuns.filter(
          (run) => run.nextCalled
        ).length
      }`
    );

    console.log(
      `Final status: ${evidence.finalStatus}`
    );

    console.log(
      `JSON evidence: ${jsonEvidencePath}`
    );

    console.log(
      `Markdown evidence: ${markdownEvidencePath}`
    );
  }
);
