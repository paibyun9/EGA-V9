import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * IMPORTANT:
 * This test loads the locally built EGA V9 SDK.
 * It does not reimplement canonicalization or Replay Root hashing.
 */
const {
  EGA,
  verifyExecution
} = require("../../packages/sdk-ts/dist/index.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "../..");

const evidenceDirectory = path.join(
  repositoryRoot,
  "publication",
  "evidence",
  "replay-root"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "replay-root-change-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "replay-root-change-evidence.md"
);

const REPEAT_COUNT = 100;

const baselineWorkflow = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    productId: "LP-001",
    quantity: 1
  },
  {
    step: 3,
    action: "checkout_request",
    approved: true
  }
];

/*
 * The only intentional mutation is the insertion of an unexpected tool step.
 */
const mutatedWorkflow = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    productId: "LP-001",
    quantity: 1
  },
  {
    step: 2.5,
    action: "unknown_external_tool",
    target: "unapproved-endpoint"
  },
  {
    step: 3,
    action: "checkout_request",
    approved: true
  }
];

/*
 * Same semantic content as the baseline, but object keys are reordered.
 * Because EGA canonicalizes object keys, this should produce the same root.
 */
const reorderedBaselineWorkflow = [
  {
    item: "laptop",
    action: "search_product",
    step: 1
  },
  {
    quantity: 1,
    productId: "LP-001",
    action: "select_product",
    step: 2
  },
  {
    approved: true,
    action: "checkout_request",
    step: 3
  }
];

const ega = EGA.init({
  appName: "ega-v9-replay-root-evidence",
  telemetry: false,
  failClosed: true,
  policyId: "replay-root-evidence-v1"
});

function calculateReplayRoot(workflow) {
  return ega.replayRoot(workflow);
}

function shortenRoot(root) {
  return `${root.slice(0, 12)}...${root.slice(-12)}`;
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Replay Root Change Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- SDK entry point: \`${evidence.sdkEntryPoint}\`
- Hash algorithm: \`${evidence.hashAlgorithm}\`
- Repetitions: ${evidence.repeatCount}

## Results

| Verification | Expected | Observed | Result |
|---|---:|---:|---:|
| Identical workflow stability | ${evidence.repeatCount}/${evidence.repeatCount} | ${evidence.baseline.matchCount}/${evidence.repeatCount} | ${evidence.assertions.identicalWorkflowStable ? "PASS" : "FAIL"} |
| Reordered object-key stability | Same root | ${evidence.reorderedBaseline.sameAsBaseline ? "Same root" : "Different root"} | ${evidence.assertions.reorderedKeysStable ? "PASS" : "FAIL"} |
| Tool-injection mutation sensitivity | Changed root | ${evidence.mutation.replayRootChanged ? "Changed root" : "Same root"} | ${evidence.assertions.mutationChangesRoot ? "PASS" : "FAIL"} |
| SDK verification consistency | Root equals direct SDK root | ${evidence.sdkConsistency.pass ? "Equal" : "Not equal"} | ${evidence.assertions.sdkConsistency ? "PASS" : "FAIL"} |

## Replay Roots

- Baseline: \`${evidence.baseline.replayRoot}\`
- Reordered baseline: \`${evidence.reorderedBaseline.replayRoot}\`
- Mutated workflow: \`${evidence.mutation.mutatedReplayRoot}\`

## Mutation

An unexpected workflow step was inserted between product selection and checkout:

\`\`\`json
${JSON.stringify(evidence.mutation.insertedStep, null, 2)}
\`\`\`

## Final Status

**${evidence.finalStatus}**

This evidence verifies only Replay Root determinism and mutation sensitivity.
It does not claim operating-system, network, VM/GPU, or model-level security coverage.
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

test("Replay Root evidence: identical workflows remain stable and mutation changes the root", async () => {
  assert.equal(
    typeof EGA,
    "function",
    "EGA must be exported by the built SDK"
  );

  assert.equal(
    typeof verifyExecution,
    "function",
    "verifyExecution must be exported by the built SDK"
  );

  assert.equal(
    typeof ega.replayRoot,
    "function",
    "EGA.replayRoot must be available"
  );

  /*
   * STEP 4:
   * Calculate the Replay Root of the same workflow 100 times.
   */
  const baselineRoots = Array.from(
    { length: REPEAT_COUNT },
    () => calculateReplayRoot(baselineWorkflow)
  );

  const baselineRoot = baselineRoots[0];

  const baselineMatchCount = baselineRoots.filter(
    (root) => root === baselineRoot
  ).length;

  const uniqueBaselineRoots = [...new Set(baselineRoots)];

  /*
   * Verifies canonical key ordering independently from mutation sensitivity.
   */
  const reorderedRoot = calculateReplayRoot(
    reorderedBaselineWorkflow
  );

  /*
   * STEP 5–6:
   * Calculate the Replay Root after inserting one unexpected tool step.
   */
  const mutatedRoot = calculateReplayRoot(mutatedWorkflow);

  /*
   * Verify that the public standalone SDK path produces the same roots.
   */
  const baselineVerification = verifyExecution(
    baselineWorkflow
  );

  const mutatedVerification = verifyExecution(
    mutatedWorkflow
  );

  const identicalWorkflowStable =
    baselineMatchCount === REPEAT_COUNT &&
    uniqueBaselineRoots.length === 1;

  const reorderedKeysStable =
    reorderedRoot === baselineRoot;

  const mutationChangesRoot =
    mutatedRoot !== baselineRoot;

  const sdkConsistency =
    baselineVerification.replayRoot === baselineRoot &&
    baselineVerification.detection.actualReplayRoot === baselineRoot &&
    mutatedVerification.replayRoot === mutatedRoot &&
    mutatedVerification.detection.actualReplayRoot === mutatedRoot;

  /*
   * Assertions fail the test immediately if an invariant is violated.
   */
  assert.equal(
    baselineMatchCount,
    REPEAT_COUNT,
    `Expected ${REPEAT_COUNT}/${REPEAT_COUNT} identical Replay Roots`
  );

  assert.equal(
    uniqueBaselineRoots.length,
    1,
    "Identical workflows produced more than one Replay Root"
  );

  assert.equal(
    reorderedRoot,
    baselineRoot,
    "Object-key reordering changed the Replay Root"
  );

  assert.notEqual(
    mutatedRoot,
    baselineRoot,
    "Inserted workflow step did not change the Replay Root"
  );

  assert.equal(
    baselineVerification.replayRoot,
    baselineRoot,
    "verifyExecution baseline root differs from EGA.replayRoot"
  );

  assert.equal(
    mutatedVerification.replayRoot,
    mutatedRoot,
    "verifyExecution mutated root differs from EGA.replayRoot"
  );

  const finalPass =
    identicalWorkflowStable &&
    reorderedKeysStable &&
    mutationChangesRoot &&
    sdkConsistency;

  /*
   * STEP 7–8:
   * Produce JSON and Markdown evidence.
   */
  const evidence = {
    schemaVersion: "ega-v9.replay-root-change-evidence.v1",
    testId: "RRC-001",
    title: "Replay Root Stability and Mutation Sensitivity",
    generatedAt: new Date().toISOString(),
    sdkEntryPoint: "packages/sdk-ts/dist/index.js",
    sdkApisUsed: [
      "EGA.init",
      "EGA.replayRoot",
      "verifyExecution"
    ],
    hashAlgorithm: "SHA-256",
    repeatCount: REPEAT_COUNT,

    scope: {
      included: [
        "identical-workflow Replay Root stability",
        "canonical object-key ordering",
        "workflow mutation sensitivity",
        "direct SDK and verifyExecution consistency"
      ],
      excluded: [
        "operating-system attacks",
        "network intrusion",
        "GPU or virtual-machine escape",
        "model-internal vulnerabilities"
      ]
    },

    baseline: {
      scenario: "approved-purchase-workflow",
      replayRoot: baselineRoot,
      replayRootDisplay: shortenRoot(baselineRoot),
      matchCount: baselineMatchCount,
      mismatchCount: REPEAT_COUNT - baselineMatchCount,
      uniqueReplayRootCount: uniqueBaselineRoots.length,
      stable: identicalWorkflowStable
    },

    reorderedBaseline: {
      scenario: "same-workflow-reordered-object-keys",
      replayRoot: reorderedRoot,
      replayRootDisplay: shortenRoot(reorderedRoot),
      sameAsBaseline: reorderedKeysStable
    },

    mutation: {
      scenario: "unexpected-tool-insertion",
      mutationType: "tool-injection",
      insertedStep: mutatedWorkflow[2],
      originalReplayRoot: baselineRoot,
      mutatedReplayRoot: mutatedRoot,
      originalReplayRootDisplay: shortenRoot(baselineRoot),
      mutatedReplayRootDisplay: shortenRoot(mutatedRoot),
      replayRootChanged: mutationChangesRoot
    },

    sdkConsistency: {
      baselineVerifyExecutionRoot:
        baselineVerification.replayRoot,
      mutatedVerifyExecutionRoot:
        mutatedVerification.replayRoot,
      pass: sdkConsistency
    },

    assertions: {
      identicalWorkflowStable,
      reorderedKeysStable,
      mutationChangesRoot,
      sdkConsistency
    },

    finalStatus: finalPass ? "PASS" : "FAIL"
  };

  await writeEvidence(evidence);

  /*
   * STEP 7:
   * Human-readable terminal report.
   */
  console.log("\n=== EGA V9 Replay Root Evidence ===");
  console.log(`Baseline root : ${baselineRoot}`);
  console.log(`Mutated root  : ${mutatedRoot}`);
  console.log(
    `Stable repeats: ${baselineMatchCount}/${REPEAT_COUNT}`
  );
  console.log(
    `Key-order stability: ${reorderedKeysStable ? "PASS" : "FAIL"}`
  );
  console.log(
    `Mutation changed root: ${mutationChangesRoot ? "PASS" : "FAIL"}`
  );
  console.log(
    `SDK consistency: ${sdkConsistency ? "PASS" : "FAIL"}`
  );
  console.log(`Final status: ${evidence.finalStatus}`);
  console.log(`JSON evidence: ${jsonEvidencePath}`);
  console.log(`Markdown evidence: ${markdownEvidencePath}`);
});
