import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * This test imports the locally built EGA V9 SDK.
 * It does not reimplement Replay Root or divergence detection.
 */
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "../..");

const evidenceDirectory = path.join(
  repositoryRoot,
  "publication",
  "evidence",
  "workflow-divergence"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "workflow-divergence-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "workflow-divergence-evidence.md"
);

const REPEAT_COUNT = 100;

/*
 * The EGA guard hashes a request envelope containing:
 *
 * appName
 * method
 * path
 * body
 * query
 * params
 *
 * The approved envelope must therefore match that exact structure.
 */
const APP_NAME = "ega-v9-workflow-divergence-evidence";

const approvedRequestEnvelope = {
  appName: APP_NAME,
  method: "POST",
  path: "/purchase",
  body: {
    workflowId: "WF-PURCHASE-001",
    steps: [
      {
        sequence: 1,
        tool: "catalog.search",
        operation: "search",
        item: "laptop"
      },
      {
        sequence: 2,
        tool: "catalog.select",
        operation: "select",
        productId: "LP-001",
        quantity: 1
      },
      {
        sequence: 3,
        tool: "commerce.checkout",
        operation: "checkout",
        approved: true
      }
    ]
  },
  query: null,
  params: null
};

/*
 * Normal execution: exactly matches the approved request.
 */
const normalRequestBody = structuredClone(
  approvedRequestEnvelope.body
);

/*
 * Divergent execution:
 * one unexpected tool invocation is inserted.
 */
const divergentRequestBody = structuredClone(
  approvedRequestEnvelope.body
);

divergentRequestBody.steps.splice(2, 0, {
  sequence: 2.5,
  tool: "external.transfer",
  operation: "send",
  unauthorized: true,
  target: "unapproved-endpoint"
});

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let responseBody;

  return {
    headers,

    setHeader(name, value) {
      headers[String(name).toLowerCase()] = String(value);
    },

    status(code) {
      statusCode = code;
      return this;
    },

    json(body) {
      responseBody = body;
    },

    snapshot() {
      return {
        statusCode,
        headers: { ...headers },
        body: responseBody
      };
    }
  };
}

function runGuard({
  ega,
  body,
  expectedReplayRoot
}) {
  const req = {
    method: "POST",
    originalUrl: "/purchase",
    body,
    query: null,
    params: null,
    headers: {
      host: "localhost",
      "user-agent": "ega-v9-evidence-runner",
      "x-ega-expected-replay-root": expectedReplayRoot,
      "x-ega-attack-type":
        body === divergentRequestBody
          ? "unauthorized-tool-invocation"
          : "none"
    }
  };

  const res = createMockResponse();
  let nextCalled = false;

  const next = () => {
    nextCalled = true;
  };

  ega.guard()(req, res, next);

  return {
    context: req.ega,
    response: res.snapshot(),
    nextCalled
  };
}

function shortenRoot(root) {
  return `${root.slice(0, 12)}...${root.slice(-12)}`;
}

function countEvents(events, type) {
  return events.filter((event) => event.type === type).length;
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Workflow Divergence Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions: ${evidence.repeatCount}
- SDK entry point: \`${evidence.sdkEntryPoint}\`

## Results

| Verification | Expected | Observed | Result |
|---|---:|---:|---:|
| Approved workflow detection | match | ${evidence.normal.detectionStatus} | ${evidence.assertions.normalDetectedAsMatch ? "PASS" : "FAIL"} |
| Divergent workflow detection | mismatch | ${evidence.divergent.detectionStatus} | ${evidence.assertions.divergenceDetectedAsMismatch ? "PASS" : "FAIL"} |
| Expected root preserved | approved root | ${evidence.divergent.expectedRootMatchedApprovedRoot ? "approved root" : "unexpected value"} | ${evidence.assertions.expectedRootPreserved ? "PASS" : "FAIL"} |
| Actual divergent root changed | different root | ${evidence.divergent.actualRootChanged ? "different root" : "same root"} | ${evidence.assertions.actualRootChanged ? "PASS" : "FAIL"} |
| replay.mismatch event | 1 per run | ${evidence.divergent.eventCounts["replay.mismatch"]}/${evidence.repeatCount} | ${evidence.assertions.replayMismatchEventsRecorded ? "PASS" : "FAIL"} |
| mutation.detected event | 1 per run | ${evidence.divergent.eventCounts["mutation.detected"]}/${evidence.repeatCount} | ${evidence.assertions.mutationDetectedEventsRecorded ? "PASS" : "FAIL"} |
| Normal false-positive count | 0 | ${evidence.normal.falsePositiveMismatchCount} | ${evidence.assertions.noNormalFalsePositive ? "PASS" : "FAIL"} |

## Replay Roots

- Approved Replay Root: \`${evidence.approvedReplayRoot}\`
- Divergent Replay Root: \`${evidence.divergent.actualReplayRoot}\`

## Inserted Divergent Step

\`\`\`json
${JSON.stringify(evidence.divergent.insertedStep, null, 2)}
\`\`\`

## Final Status

**${evidence.finalStatus}**

This test verifies workflow-divergence detection through Replay Root comparison.
Containment effectiveness and trust-state behavior require separate tests.
`;
}

async function writeEvidence(evidence) {
  await mkdir(evidenceDirectory, { recursive: true });

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
  "Workflow Divergence evidence: EGA detects an unexpected tool step as a Replay Root mismatch",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported from the built SDK"
    );

    /*
     * Generate the approved Replay Root through the real SDK.
     */
    const rootCalculator = EGA.init({
      appName: APP_NAME,
      telemetry: false,
      failClosed: true,
      policyId: "workflow-divergence-evidence-v1"
    });

    const approvedReplayRoot = rootCalculator.replayRoot(
      approvedRequestEnvelope
    );

    /*
     * STEP 4:
     * Execute the approved workflow 100 times.
     *
     * A fresh EGA instance is used for every run so event counts are
     * independent and easy to verify.
     */
    const normalRuns = [];

    for (let index = 0; index < REPEAT_COUNT; index += 1) {
      const ega = EGA.init({
        appName: APP_NAME,
        telemetry: false,
        failClosed: true,
        policyId: "workflow-divergence-evidence-v1"
      });

      const result = runGuard({
        ega,
        body: structuredClone(normalRequestBody),
        expectedReplayRoot: approvedReplayRoot
      });

      normalRuns.push({
        detectionStatus: result.context?.detection.status,
        expectedReplayRoot:
          result.context?.detection.expectedReplayRoot,
        actualReplayRoot:
          result.context?.detection.actualReplayRoot,
        nextCalled: result.nextCalled,
        statusCode: result.response.statusCode,
        replayMismatchEvents:
          countEvents(ega.events(), "replay.mismatch"),
        mutationDetectedEvents:
          countEvents(ega.events(), "mutation.detected")
      });
    }

    /*
     * STEP 5:
     * Execute the divergent workflow 100 times.
     */
    const divergentRuns = [];

    for (let index = 0; index < REPEAT_COUNT; index += 1) {
      const ega = EGA.init({
        appName: APP_NAME,
        telemetry: false,
        failClosed: true,
        policyId: "workflow-divergence-evidence-v1"
      });

      const body = structuredClone(divergentRequestBody);

      const result = runGuard({
        ega,
        body,
        expectedReplayRoot: approvedReplayRoot
      });

      divergentRuns.push({
        detectionStatus: result.context?.detection.status,
        expectedReplayRoot:
          result.context?.detection.expectedReplayRoot,
        actualReplayRoot:
          result.context?.detection.actualReplayRoot,
        nextCalled: result.nextCalled,
        statusCode: result.response.statusCode,
        replayMismatchEvents:
          countEvents(ega.events(), "replay.mismatch"),
        mutationDetectedEvents:
          countEvents(ega.events(), "mutation.detected")
      });
    }

    const normalMatchCount = normalRuns.filter(
      (run) =>
        run.detectionStatus === "match" &&
        run.expectedReplayRoot === approvedReplayRoot &&
        run.actualReplayRoot === approvedReplayRoot
    ).length;

    const normalFalsePositiveMismatchCount =
      normalRuns.filter(
        (run) =>
          run.detectionStatus === "mismatch" ||
          run.replayMismatchEvents > 0 ||
          run.mutationDetectedEvents > 0
      ).length;

    const divergenceMismatchCount =
      divergentRuns.filter(
        (run) =>
          run.detectionStatus === "mismatch"
      ).length;

    const expectedRootPreservedCount =
      divergentRuns.filter(
        (run) =>
          run.expectedReplayRoot === approvedReplayRoot
      ).length;

    const divergentActualRoots = [
      ...new Set(
        divergentRuns.map(
          (run) => run.actualReplayRoot
        )
      )
    ];

    const divergentActualReplayRoot =
      divergentActualRoots[0];

    const actualRootChangedCount =
      divergentRuns.filter(
        (run) =>
          run.actualReplayRoot !== approvedReplayRoot
      ).length;

    const replayMismatchEventCount =
      divergentRuns.reduce(
        (sum, run) =>
          sum + run.replayMismatchEvents,
        0
      );

    const mutationDetectedEventCount =
      divergentRuns.reduce(
        (sum, run) =>
          sum + run.mutationDetectedEvents,
        0
      );

    /*
     * STEP 6:
     * Assertions for Workflow Divergence only.
     *
     * Trust tier and containment details are deliberately not asserted here.
     */
    assert.equal(
      normalMatchCount,
      REPEAT_COUNT,
      "Approved workflows were not consistently classified as match"
    );

    assert.equal(
      normalFalsePositiveMismatchCount,
      0,
      "Approved workflows produced false-positive divergence events"
    );

    assert.equal(
      divergenceMismatchCount,
      REPEAT_COUNT,
      "Divergent workflows were not consistently classified as mismatch"
    );

    assert.equal(
      expectedRootPreservedCount,
      REPEAT_COUNT,
      "Expected Replay Root was not preserved during divergence checks"
    );

    assert.equal(
      actualRootChangedCount,
      REPEAT_COUNT,
      "Divergent workflow did not produce a different actual Replay Root"
    );

    assert.equal(
      divergentActualRoots.length,
      1,
      "Identical divergent workflows produced inconsistent actual Replay Roots"
    );

    assert.equal(
      replayMismatchEventCount,
      REPEAT_COUNT,
      "Expected one replay.mismatch event per divergent execution"
    );

    assert.equal(
      mutationDetectedEventCount,
      REPEAT_COUNT,
      "Expected one mutation.detected event per divergent execution"
    );

    const assertions = {
      normalDetectedAsMatch:
        normalMatchCount === REPEAT_COUNT,

      noNormalFalsePositive:
        normalFalsePositiveMismatchCount === 0,

      divergenceDetectedAsMismatch:
        divergenceMismatchCount === REPEAT_COUNT,

      expectedRootPreserved:
        expectedRootPreservedCount === REPEAT_COUNT,

      actualRootChanged:
        actualRootChangedCount === REPEAT_COUNT,

      divergentRootStable:
        divergentActualRoots.length === 1,

      replayMismatchEventsRecorded:
        replayMismatchEventCount === REPEAT_COUNT,

      mutationDetectedEventsRecorded:
        mutationDetectedEventCount === REPEAT_COUNT
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    /*
     * STEP 7:
     * Generate machine-readable and human-readable evidence.
     */
    const evidence = {
      schemaVersion:
        "ega-v9.workflow-divergence-evidence.v1",

      testId: "WD-001",

      title:
        "Workflow Divergence Detection Through Replay Root Comparison",

      generatedAt: new Date().toISOString(),

      sdkEntryPoint:
        "packages/sdk-ts/dist/index.js",

      sdkApisUsed: [
        "EGA.init",
        "EGA.replayRoot",
        "EGA.guard",
        "EGA.events"
      ],

      repeatCount: REPEAT_COUNT,

      scope: {
        included: [
          "approved workflow match classification",
          "unexpected tool-step divergence",
          "expected versus actual Replay Root comparison",
          "replay.mismatch event recording",
          "mutation.detected event recording",
          "normal-workflow false-positive check"
        ],

        excluded: [
          "trust-state escalation correctness",
          "containment effectiveness",
          "operating-system attacks",
          "network intrusion",
          "GPU or virtual-machine escape",
          "model-internal vulnerabilities"
        ]
      },

      approvedReplayRoot,

      approvedReplayRootDisplay:
        shortenRoot(approvedReplayRoot),

      normal: {
        scenario:
          "approved-purchase-workflow",

        detectionStatus:
          normalMatchCount === REPEAT_COUNT
            ? "match"
            : "inconsistent",

        matchCount: normalMatchCount,

        mismatchCount:
          REPEAT_COUNT - normalMatchCount,

        falsePositiveMismatchCount:
          normalFalsePositiveMismatchCount,

        nextCalledCount:
          normalRuns.filter(
            (run) => run.nextCalled
          ).length
      },

      divergent: {
        scenario:
          "unexpected-tool-step-insertion",

        mutationType:
          "unauthorized-tool-invocation",

        insertedStep:
          divergentRequestBody.steps[2],

        detectionStatus:
          divergenceMismatchCount === REPEAT_COUNT
            ? "mismatch"
            : "inconsistent",

        mismatchCount:
          divergenceMismatchCount,

        expectedReplayRoot:
          approvedReplayRoot,

        actualReplayRoot:
          divergentActualReplayRoot,

        actualReplayRootDisplay:
          shortenRoot(
            divergentActualReplayRoot
          ),

        expectedRootMatchedApprovedRoot:
          expectedRootPreservedCount === REPEAT_COUNT,

        actualRootChanged:
          actualRootChangedCount === REPEAT_COUNT,

        uniqueActualReplayRootCount:
          divergentActualRoots.length,

        eventCounts: {
          "replay.mismatch":
            replayMismatchEventCount,

          "mutation.detected":
            mutationDetectedEventCount
        }
      },

      assertions,

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    /*
     * Human-readable terminal output.
     */
    console.log(
      "\n=== EGA V9 Workflow Divergence Evidence ==="
    );

    console.log(
      `Approved root: ${approvedReplayRoot}`
    );

    console.log(
      `Divergent root: ${divergentActualReplayRoot}`
    );

    console.log(
      `Normal matches: ${normalMatchCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Normal false positives: ${normalFalsePositiveMismatchCount}`
    );

    console.log(
      `Divergences detected: ${divergenceMismatchCount}/${REPEAT_COUNT}`
    );

    console.log(
      `replay.mismatch events: ${replayMismatchEventCount}/${REPEAT_COUNT}`
    );

    console.log(
      `mutation.detected events: ${mutationDetectedEventCount}/${REPEAT_COUNT}`
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
