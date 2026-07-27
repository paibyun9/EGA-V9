import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * This test imports and executes the locally built EGA V9 SDK.
 *
 * It does not reimplement:
 * - Replay Root calculation
 * - risk-score calculation
 * - trust-tier assignment
 * - approval evaluation
 * - privilege-escalation gating
 */
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "../..");

const evidenceDirectory = path.join(
  repositoryRoot,
  "publication",
  "evidence",
  "trust-state"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "trust-state-escalation-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "trust-state-escalation-evidence.md"
);

const APP_NAME = "ega-v9-trust-state-evidence";
const POLICY_ID = "trust-state-evidence-v1";
const REPEAT_COUNT = 100;

/*
 * Expected SDK behavior:
 *
 * Normal:
 *   base risk 10
 *   => T1
 *
 * Mismatch in fail-closed mode:
 *   base 10 + mismatch 60 + fail-closed 15
 *   => risk 85
 *   => T3
 *
 * Mismatch plus transaction value >= 500:
 *   base 10 + mismatch 60 + fail-closed 15 + high value 10
 *   => risk 95
 *   => T4
 *
 * These expected values are asserted against the real SDK output.
 */
const EXPECTED = Object.freeze({
  normal: {
    riskScore: 10,
    trustTier: "T1",
    approvalRequired: false,
    privilegeEscalationGate: false
  },

  mismatch: {
    riskScore: 85,
    trustTier: "T3",
    approvalRequired: true,
    privilegeEscalationGate: true
  },

  highValueMismatch: {
    riskScore: 95,
    trustTier: "T4",
    approvalRequired: true,
    privilegeEscalationGate: true
  }
});

/*
 * The approved request envelope must match EGA.guard() Replay Root input:
 *
 * {
 *   appName,
 *   method,
 *   path,
 *   body,
 *   query,
 *   params
 * }
 */
const approvedBody = {
  action: "purchase",
  workflowId: "WF-TRUST-001",
  amount: 100,
  currency: "USD",
  approved: true
};

const mismatchBody = {
  action: "purchase",
  workflowId: "WF-TRUST-001",
  amount: 100,
  currency: "USD",
  approved: true,
  unauthorized: true,
  tool: "external.transfer"
};

const highValueMismatchBody = {
  action: "purchase",
  workflowId: "WF-TRUST-001",
  amount: 1000,
  currency: "USD",
  approved: true,
  unauthorized: true,
  tool: "external.transfer"
};

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

  return {
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = String(value);
    },

    status(code) {
      statusCode = code;
      return this;
    },

    json(body) {
      responseBody = body;
      return this;
    },

    snapshot() {
      return {
        headers: { ...headers },
        statusCode,
        body: responseBody
      };
    }
  };
}

function countEvents(events, eventType) {
  return events.filter(
    (event) => event.type === eventType
  ).length;
}

function getEvents(events, eventType) {
  return events.filter(
    (event) => event.type === eventType
  );
}

function runScenario({
  body,
  expectedReplayRoot,
  attackType = "none"
}) {
  const ega = EGA.init({
    appName: APP_NAME,
    telemetry: false,
    failClosed: true,
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
      "user-agent": "ega-v9-trust-state-evidence",
      "x-ega-expected-replay-root": expectedReplayRoot,
      "x-ega-attack-type": attackType
    }
  };

  const res = createMockResponse();
  let nextCalled = false;

  const next = () => {
    nextCalled = true;
  };

  ega.guard()(req, res, next);

  const events = ega.events();
  const trustEscalatedEvents = getEvents(
    events,
    "trust.escalated"
  );

  return {
    context: req.ega,
    response: res.snapshot(),
    nextCalled,
    events,

    eventCounts: {
      "trust.evaluated":
        countEvents(events, "trust.evaluated"),

      "trust.escalated":
        countEvents(events, "trust.escalated"),

      "approval.required":
        countEvents(events, "approval.required"),

      "privilege.escalation.gated":
        countEvents(
          events,
          "privilege.escalation.gated"
        ),

      "replay.mismatch":
        countEvents(events, "replay.mismatch")
    },

    trustEscalation:
      trustEscalatedEvents.length > 0
        ? trustEscalatedEvents[0].details
        : null
  };
}

function summarizeRun(run) {
  return {
    detectionStatus:
      run.context?.detection.status,

    trustTier:
      run.context?.trust.currentTier,

    riskScore:
      run.context?.trust.riskScore,

    approvalRequired:
      run.context?.trust.approvalRequired,

    privilegeEscalationGate:
      run.context?.trust.privilegeEscalationGate,

    trustReason:
      run.context?.trust.reason,

    containmentActivated:
      run.context?.containment.activated,

    executionAllowed:
      run.context?.containment.executionAllowed,

    nextCalled:
      run.nextCalled,

    statusCode:
      run.response.statusCode,

    eventCounts:
      run.eventCounts,

    trustEscalation:
      run.trustEscalation
  };
}

function shortenRoot(root) {
  return `${root.slice(0, 12)}...${root.slice(-12)}`;
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Trust State Escalation Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions per scenario: ${evidence.repeatCountPerScenario}
- Total executions: ${evidence.totalExecutions}
- SDK entry point: \`${evidence.sdkEntryPoint}\`
- Approval threshold: ${evidence.configuration.approvalThreshold}

## Results

| Scenario | Detection | Risk score | Trust tier | Approval | Privilege gate | Result |
|---|---:|---:|---:|---:|---:|---:|
| Normal approved workflow | ${evidence.normal.observed.detectionStatus} | ${evidence.normal.observed.riskScore} | ${evidence.normal.observed.trustTier} | ${evidence.normal.observed.approvalRequired} | ${evidence.normal.observed.privilegeEscalationGate} | ${evidence.normal.pass ? "PASS" : "FAIL"} |
| Replay Root mismatch | ${evidence.mismatch.observed.detectionStatus} | ${evidence.mismatch.observed.riskScore} | ${evidence.mismatch.observed.trustTier} | ${evidence.mismatch.observed.approvalRequired} | ${evidence.mismatch.observed.privilegeEscalationGate} | ${evidence.mismatch.pass ? "PASS" : "FAIL"} |
| High-value Replay Root mismatch | ${evidence.highValueMismatch.observed.detectionStatus} | ${evidence.highValueMismatch.observed.riskScore} | ${evidence.highValueMismatch.observed.trustTier} | ${evidence.highValueMismatch.observed.approvalRequired} | ${evidence.highValueMismatch.observed.privilegeEscalationGate} | ${evidence.highValueMismatch.pass ? "PASS" : "FAIL"} |

## Expected Trust Transitions

- Normal execution: \`T1 → T1\`
- Standard mismatch: \`T1 → T3\`
- High-value mismatch: \`T1 → T4\`

## Event Results

| Event | Normal | Standard mismatch | High-value mismatch |
|---|---:|---:|---:|
| \`trust.evaluated\` | ${evidence.normal.eventTotals["trust.evaluated"]}/${evidence.repeatCountPerScenario} | ${evidence.mismatch.eventTotals["trust.evaluated"]}/${evidence.repeatCountPerScenario} | ${evidence.highValueMismatch.eventTotals["trust.evaluated"]}/${evidence.repeatCountPerScenario} |
| \`trust.escalated\` | ${evidence.normal.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} | ${evidence.mismatch.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} | ${evidence.highValueMismatch.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} |
| \`approval.required\` | ${evidence.normal.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} | ${evidence.mismatch.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} | ${evidence.highValueMismatch.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} |
| \`privilege.escalation.gated\` | ${evidence.normal.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} | ${evidence.mismatch.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} | ${evidence.highValueMismatch.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} |

## Replay Roots

- Approved normal root: \`${evidence.replayRoots.approvedNormal}\`
- Approved high-value root: \`${evidence.replayRoots.approvedHighValue}\`
- Standard mismatch actual root: \`${evidence.replayRoots.standardMismatchActual}\`
- High-value mismatch actual root: \`${evidence.replayRoots.highValueMismatchActual}\`

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

This evidence verifies deterministic trust-state evaluation and escalation
for normal, Replay Root mismatch, and high-value mismatch scenarios.

Containment blocking behavior is evaluated separately.
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
  "Trust State Escalation evidence: T1 remains normal and mismatches escalate to T3 or T4",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported from the built SDK"
    );

    /*
     * Approved roots are produced by the actual SDK.
     *
     * A separate approved root is created for the high-value
     * transaction so its mismatch is caused by unauthorized
     * workflow mutation, not by the high transaction value itself.
     */
    const rootCalculator = EGA.init({
      appName: APP_NAME,
      telemetry: false,
      failClosed: true,
      policyId: POLICY_ID,
      approvalThreshold: 70
    });

    const approvedNormalReplayRoot =
      rootCalculator.replayRoot(
        createApprovedEnvelope(approvedBody)
      );

    const approvedHighValueBody = {
      action: "purchase",
      workflowId: "WF-TRUST-001",
      amount: 1000,
      currency: "USD",
      approved: true
    };

    const approvedHighValueReplayRoot =
      rootCalculator.replayRoot(
        createApprovedEnvelope(approvedHighValueBody)
      );

    const normalRuns = [];
    const mismatchRuns = [];
    const highValueMismatchRuns = [];

    /*
     * STEP 4:
     * Run all three scenarios 100 times each.
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
            approvedNormalReplayRoot
        })
      );

      mismatchRuns.push(
        runScenario({
          body: mismatchBody,
          expectedReplayRoot:
            approvedNormalReplayRoot,
          attackType:
            "unauthorized-tool-invocation"
        })
      );

      highValueMismatchRuns.push(
        runScenario({
          body: highValueMismatchBody,
          expectedReplayRoot:
            approvedHighValueReplayRoot,
          attackType:
            "unauthorized-tool-invocation"
        })
      );
    }

    function allRunsMatch(
      runs,
      predicate
    ) {
      return runs.filter(predicate).length;
    }

    function totalEvents(
      runs,
      eventType
    ) {
      return runs.reduce(
        (total, run) =>
          total +
          run.eventCounts[eventType],
        0
      );
    }

    const normalPassCount = allRunsMatch(
      normalRuns,
      (run) =>
        run.context?.detection.status === "match" &&
        run.context?.trust.currentTier ===
          EXPECTED.normal.trustTier &&
        run.context?.trust.riskScore ===
          EXPECTED.normal.riskScore &&
        run.context?.trust.approvalRequired ===
          EXPECTED.normal.approvalRequired &&
        run.context?.trust
          .privilegeEscalationGate ===
          EXPECTED.normal
            .privilegeEscalationGate
    );

    const mismatchPassCount = allRunsMatch(
      mismatchRuns,
      (run) =>
        run.context?.detection.status ===
          "mismatch" &&
        run.context?.trust.currentTier ===
          EXPECTED.mismatch.trustTier &&
        run.context?.trust.riskScore ===
          EXPECTED.mismatch.riskScore &&
        run.context?.trust.approvalRequired ===
          EXPECTED.mismatch
            .approvalRequired &&
        run.context?.trust
          .privilegeEscalationGate ===
          EXPECTED.mismatch
            .privilegeEscalationGate
    );

    const highValueMismatchPassCount =
      allRunsMatch(
        highValueMismatchRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.trust.currentTier ===
            EXPECTED.highValueMismatch
              .trustTier &&
          run.context?.trust.riskScore ===
            EXPECTED.highValueMismatch
              .riskScore &&
          run.context?.trust
            .approvalRequired ===
            EXPECTED.highValueMismatch
              .approvalRequired &&
          run.context?.trust
            .privilegeEscalationGate ===
            EXPECTED.highValueMismatch
              .privilegeEscalationGate
      );

    const normalTrustEvaluatedEvents =
      totalEvents(
        normalRuns,
        "trust.evaluated"
      );

    const normalTrustEscalatedEvents =
      totalEvents(
        normalRuns,
        "trust.escalated"
      );

    const normalApprovalRequiredEvents =
      totalEvents(
        normalRuns,
        "approval.required"
      );

    const normalPrivilegeGateEvents =
      totalEvents(
        normalRuns,
        "privilege.escalation.gated"
      );

    const mismatchTrustEvaluatedEvents =
      totalEvents(
        mismatchRuns,
        "trust.evaluated"
      );

    const mismatchTrustEscalatedEvents =
      totalEvents(
        mismatchRuns,
        "trust.escalated"
      );

    const mismatchApprovalRequiredEvents =
      totalEvents(
        mismatchRuns,
        "approval.required"
      );

    const mismatchPrivilegeGateEvents =
      totalEvents(
        mismatchRuns,
        "privilege.escalation.gated"
      );

    const highTrustEvaluatedEvents =
      totalEvents(
        highValueMismatchRuns,
        "trust.evaluated"
      );

    const highTrustEscalatedEvents =
      totalEvents(
        highValueMismatchRuns,
        "trust.escalated"
      );

    const highApprovalRequiredEvents =
      totalEvents(
        highValueMismatchRuns,
        "approval.required"
      );

    const highPrivilegeGateEvents =
      totalEvents(
        highValueMismatchRuns,
        "privilege.escalation.gated"
      );

    /*
     * STEP 5:
     * Verify escalation event transition details.
     */
    const mismatchTransitionsCorrect =
      allRunsMatch(
        mismatchRuns,
        (run) =>
          run.trustEscalation?.from === "T1" &&
          run.trustEscalation?.to === "T3" &&
          run.trustEscalation?.riskScore === 85
      );

    const highValueTransitionsCorrect =
      allRunsMatch(
        highValueMismatchRuns,
        (run) =>
          run.trustEscalation?.from === "T1" &&
          run.trustEscalation?.to === "T4" &&
          run.trustEscalation?.riskScore === 95
      );

    /*
     * STEP 6:
     * Hard assertions.
     */
    assert.equal(
      normalPassCount,
      REPEAT_COUNT,
      "Normal workflow did not remain at T1 in every execution"
    );

    assert.equal(
      mismatchPassCount,
      REPEAT_COUNT,
      "Replay mismatch did not escalate to T3 in every execution"
    );

    assert.equal(
      highValueMismatchPassCount,
      REPEAT_COUNT,
      "High-value mismatch did not escalate to T4 in every execution"
    );

    assert.equal(
      normalTrustEvaluatedEvents,
      REPEAT_COUNT,
      "Normal workflow must emit one trust.evaluated event per run"
    );

    assert.equal(
      normalTrustEscalatedEvents,
      0,
      "Normal workflow must not emit trust.escalated"
    );

    assert.equal(
      normalApprovalRequiredEvents,
      0,
      "Normal workflow must not require approval"
    );

    assert.equal(
      normalPrivilegeGateEvents,
      0,
      "Normal workflow must not activate the privilege gate"
    );

    assert.equal(
      mismatchTrustEvaluatedEvents,
      REPEAT_COUNT,
      "Mismatch must emit one trust.evaluated event per run"
    );

    assert.equal(
      mismatchTrustEscalatedEvents,
      REPEAT_COUNT,
      "Mismatch must emit one trust.escalated event per run"
    );

    assert.equal(
      mismatchApprovalRequiredEvents,
      REPEAT_COUNT,
      "T3 mismatch must require approval"
    );

    assert.equal(
      mismatchPrivilegeGateEvents,
      REPEAT_COUNT,
      "T3 mismatch must activate the privilege gate"
    );

    assert.equal(
      highTrustEvaluatedEvents,
      REPEAT_COUNT,
      "High-value mismatch must emit one trust.evaluated event per run"
    );

    assert.equal(
      highTrustEscalatedEvents,
      REPEAT_COUNT,
      "High-value mismatch must emit one trust.escalated event per run"
    );

    assert.equal(
      highApprovalRequiredEvents,
      REPEAT_COUNT,
      "T4 mismatch must require approval"
    );

    assert.equal(
      highPrivilegeGateEvents,
      REPEAT_COUNT,
      "T4 mismatch must activate the privilege gate"
    );

    assert.equal(
      mismatchTransitionsCorrect,
      REPEAT_COUNT,
      "Mismatch trust.escalated transition was not consistently T1 to T3"
    );

    assert.equal(
      highValueTransitionsCorrect,
      REPEAT_COUNT,
      "High-value mismatch transition was not consistently T1 to T4"
    );

    const normalSample =
      summarizeRun(normalRuns[0]);

    const mismatchSample =
      summarizeRun(mismatchRuns[0]);

    const highValueMismatchSample =
      summarizeRun(
        highValueMismatchRuns[0]
      );

    const assertions = {
      normalRemainsT1:
        normalPassCount === REPEAT_COUNT,

      standardMismatchEscalatesT1ToT3:
        mismatchPassCount ===
          REPEAT_COUNT,

      highValueMismatchEscalatesT1ToT4:
        highValueMismatchPassCount ===
          REPEAT_COUNT,

      normalHasNoTrustEscalation:
        normalTrustEscalatedEvents === 0,

      normalHasNoApprovalRequirement:
        normalApprovalRequiredEvents === 0,

      normalHasNoPrivilegeGate:
        normalPrivilegeGateEvents === 0,

      standardMismatchTrustEvaluated:
        mismatchTrustEvaluatedEvents ===
          REPEAT_COUNT,

      standardMismatchTrustEscalated:
        mismatchTrustEscalatedEvents ===
          REPEAT_COUNT,

      standardMismatchApprovalRequired:
        mismatchApprovalRequiredEvents ===
          REPEAT_COUNT,

      standardMismatchPrivilegeGate:
        mismatchPrivilegeGateEvents ===
          REPEAT_COUNT,

      highValueMismatchTrustEvaluated:
        highTrustEvaluatedEvents ===
          REPEAT_COUNT,

      highValueMismatchTrustEscalated:
        highTrustEscalatedEvents ===
          REPEAT_COUNT,

      highValueMismatchApprovalRequired:
        highApprovalRequiredEvents ===
          REPEAT_COUNT,

      highValueMismatchPrivilegeGate:
        highPrivilegeGateEvents ===
          REPEAT_COUNT,

      standardTransitionDetailsCorrect:
        mismatchTransitionsCorrect ===
          REPEAT_COUNT,

      highValueTransitionDetailsCorrect:
        highValueTransitionsCorrect ===
          REPEAT_COUNT
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    const evidence = {
      schemaVersion:
        "ega-v9.trust-state-escalation-evidence.v1",

      testId: "TS-001",

      title:
        "Deterministic Trust State Evaluation and Escalation",

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
        failClosed: true,
        approvalThreshold: 70,
        repeatCountPerScenario:
          REPEAT_COUNT
      },

      repeatCountPerScenario:
        REPEAT_COUNT,

      totalExecutions:
        REPEAT_COUNT * 3,

      scope: {
        included: [
          "normal T1 trust-state evaluation",
          "Replay Root mismatch T1-to-T3 escalation",
          "high-value mismatch T1-to-T4 escalation",
          "risk-score consistency",
          "approval-required evaluation",
          "privilege-escalation gate evaluation",
          "trust governance event recording"
        ],

        excluded: [
          "containment response correctness",
          "network and operating-system security",
          "model-level security",
          "remote policy enforcement"
        ]
      },

      replayRoots: {
        approvedNormal:
          approvedNormalReplayRoot,

        approvedNormalDisplay:
          shortenRoot(
            approvedNormalReplayRoot
          ),

        approvedHighValue:
          approvedHighValueReplayRoot,

        approvedHighValueDisplay:
          shortenRoot(
            approvedHighValueReplayRoot
          ),

        standardMismatchActual:
          mismatchRuns[0].context
            .detection.actualReplayRoot,

        highValueMismatchActual:
          highValueMismatchRuns[0].context
            .detection.actualReplayRoot
      },

      normal: {
        scenario:
          "approved-normal-transaction",

        expected:
          EXPECTED.normal,

        observed:
          normalSample,

        passCount:
          normalPassCount,

        failCount:
          REPEAT_COUNT -
          normalPassCount,

        eventTotals: {
          "trust.evaluated":
            normalTrustEvaluatedEvents,

          "trust.escalated":
            normalTrustEscalatedEvents,

          "approval.required":
            normalApprovalRequiredEvents,

          "privilege.escalation.gated":
            normalPrivilegeGateEvents
        },

        pass:
          normalPassCount ===
          REPEAT_COUNT
      },

      mismatch: {
        scenario:
          "standard-replay-root-mismatch",

        expected:
          EXPECTED.mismatch,

        observed:
          mismatchSample,

        expectedTransition: {
          from: "T1",
          to: "T3"
        },

        passCount:
          mismatchPassCount,

        failCount:
          REPEAT_COUNT -
          mismatchPassCount,

        transitionPassCount:
          mismatchTransitionsCorrect,

        eventTotals: {
          "trust.evaluated":
            mismatchTrustEvaluatedEvents,

          "trust.escalated":
            mismatchTrustEscalatedEvents,

          "approval.required":
            mismatchApprovalRequiredEvents,

          "privilege.escalation.gated":
            mismatchPrivilegeGateEvents
        },

        pass:
          mismatchPassCount ===
            REPEAT_COUNT &&
          mismatchTransitionsCorrect ===
            REPEAT_COUNT
      },

      highValueMismatch: {
        scenario:
          "high-value-replay-root-mismatch",

        expected:
          EXPECTED.highValueMismatch,

        observed:
          highValueMismatchSample,

        expectedTransition: {
          from: "T1",
          to: "T4"
        },

        passCount:
          highValueMismatchPassCount,

        failCount:
          REPEAT_COUNT -
          highValueMismatchPassCount,

        transitionPassCount:
          highValueTransitionsCorrect,

        eventTotals: {
          "trust.evaluated":
            highTrustEvaluatedEvents,

          "trust.escalated":
            highTrustEscalatedEvents,

          "approval.required":
            highApprovalRequiredEvents,

          "privilege.escalation.gated":
            highPrivilegeGateEvents
        },

        pass:
          highValueMismatchPassCount ===
            REPEAT_COUNT &&
          highValueTransitionsCorrect ===
            REPEAT_COUNT
      },

      assertions,

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    console.log(
      "\n=== EGA V9 Trust State Escalation Evidence ==="
    );

    console.log(
      `Normal T1 results: ${normalPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Standard mismatch T1 -> T3: ${mismatchPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `High-value mismatch T1 -> T4: ${highValueMismatchPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Normal escalation events: ${normalTrustEscalatedEvents}`
    );

    console.log(
      `T3 trust.escalated events: ${mismatchTrustEscalatedEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `T4 trust.escalated events: ${highTrustEscalatedEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `T3 approval.required events: ${mismatchApprovalRequiredEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `T4 approval.required events: ${highApprovalRequiredEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `T3 privilege gates: ${mismatchPrivilegeGateEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `T4 privilege gates: ${highPrivilegeGateEvents}/${REPEAT_COUNT}`
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
