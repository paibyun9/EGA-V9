import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * Use the locally built EGA V9 SDK.
 *
 * This test does not reimplement:
 * - canonical serialization
 * - Replay Root calculation
 * - mismatch detection
 * - mutation detection
 * - governance event generation
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
  "tool-order"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "tool-order-mutation-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "tool-order-mutation-evidence.md"
);

const APP_NAME = "ega-v9-tool-order-evidence";
const POLICY_ID = "tool-order-mutation-v1";
const TEST_ID = "TO-001";
const REPEAT_COUNT = 100;

/*
 * Approved workflow:
 *
 * 1. Search catalog
 * 2. Select product
 * 3. Checkout
 */
const approvedBody = {
  workflowId: "WF-TOOL-ORDER-001",
  action: "purchase",
  amount: 100,
  currency: "USD",
  approved: true,
  tools: [
    {
      sequence: 1,
      name: "catalog.search",
      arguments: {
        query: "laptop"
      }
    },
    {
      sequence: 2,
      name: "catalog.select",
      arguments: {
        productId: "LP-001",
        quantity: 1
      }
    },
    {
      sequence: 3,
      name: "commerce.checkout",
      arguments: {
        approved: true,
        currency: "USD"
      }
    }
  ]
};

/*
 * Tool-order mutation:
 *
 * The same three tools and the same parameters are retained,
 * but the first two tool invocations are reversed.
 *
 * Approved:
 *   search -> select -> checkout
 *
 * Mutated:
 *   select -> search -> checkout
 */
const reorderedBody = {
  workflowId: "WF-TOOL-ORDER-001",
  action: "purchase",
  amount: 100,
  currency: "USD",
  approved: true,
  tools: [
    {
      sequence: 1,
      name: "catalog.select",
      arguments: {
        productId: "LP-001",
        quantity: 1
      }
    },
    {
      sequence: 2,
      name: "catalog.search",
      arguments: {
        query: "laptop"
      }
    },
    {
      sequence: 3,
      name: "commerce.checkout",
      arguments: {
        approved: true,
        currency: "USD"
      }
    }
  ]
};

function createEnvelope(body) {
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

  return {
    setHeader(name, value) {
      headers[String(name).toLowerCase()] =
        String(value);
    },

    status(code) {
      statusCode = code;
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
        jsonCallCount
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
  attackType
}) {
  /*
   * Observe mode is used here to isolate detection evidence
   * from fail-closed blocking evidence.
   *
   * FC-001 separately verifies execution prevention.
   */
  const ega = EGA.init({
    appName: APP_NAME,
    telemetry: false,
    failClosed: false,
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
        "ega-v9-tool-order-evidence",

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
        countEvents(
          events,
          "workflow.verified"
        ),

      "hash.verified":
        countEvents(
          events,
          "hash.verified"
        ),

      "replay.mismatch":
        countEvents(
          events,
          "replay.mismatch"
        ),

      "mutation.detected":
        countEvents(
          events,
          "mutation.detected"
        ),

      "containment.activated":
        countEvents(
          events,
          "containment.activated"
        ),

      "execution.blocked":
        countEvents(
          events,
          "execution.blocked"
        )
    }
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

function uniqueValues(values) {
  return [...new Set(values)];
}

function summarizeRun(run) {
  return {
    detectionStatus:
      run.context?.detection.status,

    expectedReplayRoot:
      run.context?.detection.expectedReplayRoot,

    actualReplayRoot:
      run.context?.detection.actualReplayRoot,

    trustTier:
      run.context?.trust.currentTier,

    riskScore:
      run.context?.trust.riskScore,

    containmentActivated:
      run.context?.containment.activated,

    containmentMode:
      run.context?.containment.mode,

    executionAllowed:
      run.context?.containment.executionAllowed,

    nextCalled:
      run.nextCalled,

    nextCallCount:
      run.nextCallCount,

    statusCode:
      run.response.statusCode,

    eventCounts:
      run.eventCounts
  };
}

function shortenRoot(root) {
  return `${root.slice(0, 12)}...${root.slice(-12)}`;
}

function toolNames(body) {
  return body.tools.map(
    (tool) => tool.name
  );
}

function sortedToolNames(body) {
  return [...toolNames(body)].sort();
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Tool Order Mutation Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions per scenario: ${evidence.repeatCountPerScenario}
- Total executions: ${evidence.totalExecutions}
- SDK entry point: \`${evidence.sdkEntryPoint}\`
- Runtime mode: \`${evidence.configuration.runtimeMode}\`

## Mutation Definition

The approved and reordered workflows contain the same tools and
the same tool count. Only the invocation order is changed.

### Approved Order

\`${evidence.toolOrders.approved.join(" → ")}\`

### Reordered Execution

\`${evidence.toolOrders.reordered.join(" → ")}\`

## Results

| Scenario | Detection | Stable root | Match count | Mismatch count | Result |
|---|---:|---:|---:|---:|---:|
| Approved tool order | ${evidence.approved.observed.detectionStatus} | ${evidence.approved.stableRoot ? "true" : "false"} | ${evidence.approved.matchCount}/${evidence.repeatCountPerScenario} | ${evidence.approved.mismatchCount}/${evidence.repeatCountPerScenario} | ${evidence.approved.pass ? "PASS" : "FAIL"} |
| Reordered tools | ${evidence.reordered.observed.detectionStatus} | ${evidence.reordered.stableRoot ? "true" : "false"} | ${evidence.reordered.matchCount}/${evidence.repeatCountPerScenario} | ${evidence.reordered.mismatchCount}/${evidence.repeatCountPerScenario} | ${evidence.reordered.pass ? "PASS" : "FAIL"} |

## Replay Roots

- Approved Replay Root: \`${evidence.replayRoots.approved}\`
- Reordered Replay Root: \`${evidence.replayRoots.reordered}\`
- Roots differ: \`${evidence.replayRoots.changed}\`

## Governance Events

| Event | Approved order | Reordered tools |
|---|---:|---:|
| \`replay.mismatch\` | ${evidence.approved.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} | ${evidence.reordered.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} |
| \`mutation.detected\` | ${evidence.approved.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} | ${evidence.reordered.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} |
| \`execution.blocked\` | ${evidence.approved.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} | ${evidence.reordered.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} |

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

This evidence verifies that changing only tool invocation order
changes the Replay Root and is detected as a deterministic workflow
mismatch.

Fail-closed execution blocking is evaluated separately by FC-001.
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
  "Tool Order Mutation evidence: reversing tool invocation order changes the Replay Root and triggers mismatch detection",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported by the built SDK"
    );

    /*
     * Structural preconditions:
     *
     * The test must change order only.
     * It must not add or remove tools.
     */
    const approvedNames =
      toolNames(approvedBody);

    const reorderedNames =
      toolNames(reorderedBody);

    assert.equal(
      approvedNames.length,
      reorderedNames.length,
      "Tool count changed unexpectedly"
    );

    assert.deepEqual(
      sortedToolNames(approvedBody),
      sortedToolNames(reorderedBody),
      "Approved and reordered workflows do not contain the same tools"
    );

    assert.notDeepEqual(
      approvedNames,
      reorderedNames,
      "Tool invocation order did not change"
    );

    /*
     * Produce roots with the real SDK.
     */
    const rootCalculator = EGA.init({
      appName: APP_NAME,
      telemetry: false,
      failClosed: false,
      policyId: POLICY_ID
    });

    const approvedReplayRoot =
      rootCalculator.replayRoot(
        createEnvelope(approvedBody)
      );

    const reorderedReplayRoot =
      rootCalculator.replayRoot(
        createEnvelope(reorderedBody)
      );

    /*
     * The order mutation must change the Replay Root.
     */
    assert.notEqual(
      approvedReplayRoot,
      reorderedReplayRoot,
      "Tool-order mutation did not change the Replay Root"
    );

    const approvedRuns = [];
    const reorderedRuns = [];

    /*
     * Run both scenarios 100 times.
     */
    for (
      let index = 0;
      index < REPEAT_COUNT;
      index += 1
    ) {
      approvedRuns.push(
        runScenario({
          body: approvedBody,
          expectedReplayRoot:
            approvedReplayRoot,
          attackType: "none"
        })
      );

      reorderedRuns.push(
        runScenario({
          body: reorderedBody,
          expectedReplayRoot:
            approvedReplayRoot,
          attackType:
            "tool-order-mutation"
        })
      );
    }

    const approvedPassCount =
      countMatchingRuns(
        approvedRuns,
        (run) =>
          run.context?.detection.status ===
            "match" &&
          run.context?.detection
            .actualReplayRoot ===
            approvedReplayRoot &&
          run.eventCounts[
            "replay.mismatch"
          ] === 0 &&
          run.eventCounts[
            "mutation.detected"
          ] === 0 &&
          run.nextCalled === true &&
          run.nextCallCount === 1
      );

    const reorderedPassCount =
      countMatchingRuns(
        reorderedRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.detection
            .expectedReplayRoot ===
            approvedReplayRoot &&
          run.context?.detection
            .actualReplayRoot ===
            reorderedReplayRoot &&
          run.eventCounts[
            "replay.mismatch"
          ] === 1 &&
          run.eventCounts[
            "mutation.detected"
          ] === 1 &&
          run.nextCalled === true &&
          run.nextCallCount === 1
      );

    const approvedActualRoots =
      uniqueValues(
        approvedRuns.map(
          (run) =>
            run.context.detection
              .actualReplayRoot
        )
      );

    const reorderedActualRoots =
      uniqueValues(
        reorderedRuns.map(
          (run) =>
            run.context.detection
              .actualReplayRoot
        )
      );

    const approvedMismatchEvents =
      totalEvents(
        approvedRuns,
        "replay.mismatch"
      );

    const approvedMutationEvents =
      totalEvents(
        approvedRuns,
        "mutation.detected"
      );

    const reorderedMismatchEvents =
      totalEvents(
        reorderedRuns,
        "replay.mismatch"
      );

    const reorderedMutationEvents =
      totalEvents(
        reorderedRuns,
        "mutation.detected"
      );

    const reorderedBlockedEvents =
      totalEvents(
        reorderedRuns,
        "execution.blocked"
      );

    /*
     * Hard assertions.
     */
    assert.equal(
      approvedPassCount,
      REPEAT_COUNT,
      "Approved tool order did not match in all executions"
    );

    assert.equal(
      reorderedPassCount,
      REPEAT_COUNT,
      "Reordered tools were not detected in all executions"
    );

    assert.equal(
      approvedActualRoots.length,
      1,
      "Approved Replay Root was not stable"
    );

    assert.equal(
      reorderedActualRoots.length,
      1,
      "Reordered Replay Root was not stable"
    );

    assert.equal(
      approvedActualRoots[0],
      approvedReplayRoot,
      "Approved runtime root differs from the directly calculated root"
    );

    assert.equal(
      reorderedActualRoots[0],
      reorderedReplayRoot,
      "Reordered runtime root differs from the directly calculated root"
    );

    assert.notEqual(
      approvedActualRoots[0],
      reorderedActualRoots[0],
      "Approved and reordered workflows produced the same root"
    );

    assert.equal(
      approvedMismatchEvents,
      0,
      "Approved order generated false mismatch events"
    );

    assert.equal(
      approvedMutationEvents,
      0,
      "Approved order generated false mutation events"
    );

    assert.equal(
      reorderedMismatchEvents,
      REPEAT_COUNT,
      "Reordered workflow must generate one replay.mismatch event per execution"
    );

    assert.equal(
      reorderedMutationEvents,
      REPEAT_COUNT,
      "Reordered workflow must generate one mutation.detected event per execution"
    );

    assert.equal(
      reorderedBlockedEvents,
      0,
      "Observe-mode tool-order evidence must not generate execution.blocked"
    );

    const approvedSample =
      summarizeRun(approvedRuns[0]);

    const reorderedSample =
      summarizeRun(reorderedRuns[0]);

    const assertions = {
      sameToolCount:
        approvedNames.length ===
        reorderedNames.length,

      sameToolSet:
        JSON.stringify(
          sortedToolNames(approvedBody)
        ) ===
        JSON.stringify(
          sortedToolNames(reorderedBody)
        ),

      orderActuallyChanged:
        JSON.stringify(approvedNames) !==
        JSON.stringify(reorderedNames),

      toolOrderChangesReplayRoot:
        approvedReplayRoot !==
        reorderedReplayRoot,

      approvedRootStable100:
        approvedActualRoots.length === 1 &&
        approvedPassCount === REPEAT_COUNT,

      reorderedRootStable100:
        reorderedActualRoots.length === 1,

      approvedMatches100:
        approvedPassCount === REPEAT_COUNT,

      approvedFalsePositivesZero:
        approvedMismatchEvents === 0 &&
        approvedMutationEvents === 0,

      reorderedMismatchDetected100:
        reorderedPassCount ===
        REPEAT_COUNT,

      replayMismatchEvents100:
        reorderedMismatchEvents ===
        REPEAT_COUNT,

      mutationDetectedEvents100:
        reorderedMutationEvents ===
        REPEAT_COUNT,

      directAndRuntimeRootsConsistent:
        approvedActualRoots[0] ===
          approvedReplayRoot &&
        reorderedActualRoots[0] ===
          reorderedReplayRoot,

      observeModeDoesNotBlock:
        reorderedBlockedEvents === 0 &&
        reorderedRuns.every(
          (run) => run.nextCalled === true
        )
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    const evidence = {
      schemaVersion:
        "ega-v9.tool-order-mutation-evidence.v1",

      testId: TEST_ID,

      title:
        "Deterministic Detection of Tool Invocation Order Mutation",

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

      configuration: {
        runtimeMode: "observe",
        failClosed: false,
        repeatCountPerScenario:
          REPEAT_COUNT
      },

      repeatCountPerScenario:
        REPEAT_COUNT,

      totalExecutions:
        REPEAT_COUNT * 2,

      mutationDefinition: {
        type: "tool-order-mutation",

        description:
          "The workflow retains the same tools, tool count, and tool arguments while reversing the first two tool invocations.",

        addedTools: 0,
        removedTools: 0,
        reorderedTools: 2
      },

      toolOrders: {
        approved: approvedNames,
        reordered: reorderedNames
      },

      replayRoots: {
        approved:
          approvedReplayRoot,

        approvedDisplay:
          shortenRoot(
            approvedReplayRoot
          ),

        reordered:
          reorderedReplayRoot,

        reorderedDisplay:
          shortenRoot(
            reorderedReplayRoot
          ),

        changed:
          approvedReplayRoot !==
          reorderedReplayRoot
      },

      approved: {
        scenario:
          "approved-tool-order",

        expected: {
          detectionStatus: "match",
          replayMismatchEvents: 0,
          mutationDetectedEvents: 0
        },

        observed:
          approvedSample,

        matchCount:
          approvedPassCount,

        mismatchCount:
          REPEAT_COUNT -
          approvedPassCount,

        stableRoot:
          approvedActualRoots.length === 1,

        uniqueActualRoots:
          approvedActualRoots,

        eventTotals: {
          "replay.mismatch":
            approvedMismatchEvents,

          "mutation.detected":
            approvedMutationEvents,

          "execution.blocked":
            totalEvents(
              approvedRuns,
              "execution.blocked"
            )
        },

        pass:
          approvedPassCount ===
          REPEAT_COUNT
      },

      reordered: {
        scenario:
          "reordered-tool-execution",

        expected: {
          detectionStatus: "mismatch",
          replayMismatchEvents:
            REPEAT_COUNT,
          mutationDetectedEvents:
            REPEAT_COUNT
        },

        observed:
          reorderedSample,

        matchCount: 0,

        mismatchCount:
          reorderedPassCount,

        stableRoot:
          reorderedActualRoots.length === 1,

        uniqueActualRoots:
          reorderedActualRoots,

        eventTotals: {
          "replay.mismatch":
            reorderedMismatchEvents,

          "mutation.detected":
            reorderedMutationEvents,

          "execution.blocked":
            reorderedBlockedEvents
        },

        pass:
          reorderedPassCount ===
          REPEAT_COUNT
      },

      assertions,

      scope: {
        included: [
          "tool invocation order integrity",
          "Replay Root sensitivity to array order",
          "deterministic mismatch detection",
          "false-positive check for approved order",
          "replay.mismatch event generation",
          "mutation.detected event generation"
        ],

        excluded: [
          "tool insertion",
          "tool deletion",
          "tool argument mutation",
          "fail-closed execution blocking",
          "remote infrastructure security"
        ]
      },

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    console.log(
      "\n=== EGA V9 Tool Order Mutation Evidence ==="
    );

    console.log(
      `Approved order: ${approvedNames.join(" -> ")}`
    );

    console.log(
      `Reordered tools: ${reorderedNames.join(" -> ")}`
    );

    console.log(
      `Approved root: ${approvedReplayRoot}`
    );

    console.log(
      `Reordered root: ${reorderedReplayRoot}`
    );

    console.log(
      `Approved matches: ${approvedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Approved false positives: ${approvedMismatchEvents}`
    );

    console.log(
      `Tool-order mismatches detected: ${reorderedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `replay.mismatch events: ${reorderedMismatchEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `mutation.detected events: ${reorderedMutationEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `Stable reordered roots: ${reorderedActualRoots.length === 1 ? "PASS" : "FAIL"}`
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
