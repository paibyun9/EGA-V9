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
 * The test intentionally relies on the real SDK for:
 * - Replay Root generation
 * - workflow mismatch detection
 * - trust-state evaluation
 * - approval-required decisions
 * - privilege-escalation gating
 * - quarantine generation
 * - fail-closed containment
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
  "approval-bypass"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "approval-bypass-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "approval-bypass-evidence.md"
);

const APP_NAME = "ega-v9-approval-bypass-evidence";
const POLICY_ID = "approval-bypass-policy-v1";
const TEST_ID = "AB-001";
const REPEAT_COUNT = 100;

/*
 * Legitimately approved workflow.
 *
 * The approval information is part of the sealed workflow identity.
 */
const approvedBody = {
  workflowId: "WF-APPROVAL-001",
  action: "purchase",
  amount: 100,
  currency: "USD",

  approval: {
    required: true,
    status: "approved",
    approvedBy: "human-reviewer-01",
    approvalId: "APR-2026-0001",
    approvalMethod: "human-review",
    decision: "allow"
  },

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
        productId: "LP-001",
        quantity: 1,
        currency: "USD"
      }
    }
  ]
};

/*
 * Approval-bypass mutation.
 *
 * Tools, amount, currency, and workflow ID remain unchanged.
 * Only approval-governance evidence is manipulated.
 */
const bypassedBody = {
  workflowId: "WF-APPROVAL-001",
  action: "purchase",
  amount: 100,
  currency: "USD",

  approval: {
    required: false,
    status: "bypassed",
    approvedBy: "agent-self",
    approvalId: null,
    approvalMethod: "self-authorized",
    decision: "allow"
  },

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
        productId: "LP-001",
        quantity: 1,
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
   * Fail-closed mode is intentional.
   *
   * AB-001 verifies that an approval-state mutation
   * cannot continue to downstream execution.
   */
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

      "user-agent":
        "ega-v9-approval-bypass-evidence",

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
    decision: req.egaDecision,
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

      "trust.escalated":
        countEvents(
          events,
          "trust.escalated"
        ),

      "approval.required":
        countEvents(
          events,
          "approval.required"
        ),

      "privilege.escalation.gated":
        countEvents(
          events,
          "privilege.escalation.gated"
        ),

      "quarantine.created":
        countEvents(
          events,
          "quarantine.created"
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

    approvalRequired:
      run.context?.trust.approvalRequired,

    privilegeEscalationGate:
      run.context?.trust.privilegeEscalationGate,

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

    responseBody:
      run.response.body,

    eventCounts:
      run.eventCounts
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Approval Bypass Mutation Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions per scenario: ${evidence.repeatCountPerScenario}
- Total executions: ${evidence.totalExecutions}
- SDK entry point: \`${evidence.sdkEntryPoint}\`
- Runtime mode: \`${evidence.configuration.runtimeMode}\`

## Threat Definition

The approved workflow contains a legitimate human-approval record.

The bypass mutation attempts to:

- remove the approval requirement;
- replace the approved state with a bypassed state;
- replace the human reviewer with self-authorization;
- remove the approval identifier;
- continue to checkout without valid approval evidence.

All business values and tool calls remain unchanged.

## Approval-State Comparison

| Field | Approved workflow | Bypass mutation |
|---|---|---|
| Required | \`${evidence.approvalStates.approved.required}\` | \`${evidence.approvalStates.bypassed.required}\` |
| Status | \`${evidence.approvalStates.approved.status}\` | \`${evidence.approvalStates.bypassed.status}\` |
| Approved by | \`${evidence.approvalStates.approved.approvedBy}\` | \`${evidence.approvalStates.bypassed.approvedBy}\` |
| Approval ID | \`${evidence.approvalStates.approved.approvalId}\` | \`${evidence.approvalStates.bypassed.approvalId}\` |
| Method | \`${evidence.approvalStates.approved.approvalMethod}\` | \`${evidence.approvalStates.bypassed.approvalMethod}\` |

## Results

| Scenario | Detection | Execution allowed | next() calls | HTTP status | Result |
|---|---:|---:|---:|---:|---:|
| Legitimately approved workflow | ${evidence.approved.observed.detectionStatus} | ${evidence.approved.observed.executionAllowed} | ${evidence.approved.nextCalledCount}/${evidence.repeatCountPerScenario} | ${evidence.approved.observed.statusCode} | ${evidence.approved.pass ? "PASS" : "FAIL"} |
| Approval-bypass mutation | ${evidence.bypassed.observed.detectionStatus} | ${evidence.bypassed.observed.executionAllowed} | ${evidence.bypassed.nextCalledCount}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.observed.statusCode} | ${evidence.bypassed.pass ? "PASS" : "FAIL"} |

## Replay Roots

- Approved Replay Root: \`${evidence.replayRoots.approved}\`
- Bypassed Replay Root: \`${evidence.replayRoots.bypassed}\`
- Roots differ: \`${evidence.replayRoots.changed}\`

## Governance Events

| Event | Approved workflow | Approval bypass |
|---|---:|---:|
| \`replay.mismatch\` | ${evidence.approved.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} |
| \`mutation.detected\` | ${evidence.approved.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} |
| \`trust.escalated\` | ${evidence.approved.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} |
| \`approval.required\` | ${evidence.approved.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} |
| \`privilege.escalation.gated\` | ${evidence.approved.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} |
| \`containment.activated\` | ${evidence.approved.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} |
| \`execution.blocked\` | ${evidence.approved.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} | ${evidence.bypassed.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} |

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

This evidence demonstrates that approval-governance state is part of
the deterministic workflow identity. Altering or removing the sealed
approval record changes the Replay Root, triggers governance escalation,
and prevents downstream execution under fail-closed mode.

## Scope Boundary

AB-001 verifies mutation detection against a previously sealed approval
record. It does not independently authenticate a human identity or verify
a cryptographic approval signature.
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
  "Approval Bypass evidence: mutated approval state changes the Replay Root and is blocked under fail-closed mode",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported by the built SDK"
    );

    /*
     * Structural preconditions.
     *
     * The attack must alter approval evidence only.
     */
    assert.equal(
      approvedBody.workflowId,
      bypassedBody.workflowId,
      "Workflow ID changed unexpectedly"
    );

    assert.equal(
      approvedBody.action,
      bypassedBody.action,
      "Workflow action changed unexpectedly"
    );

    assert.equal(
      approvedBody.amount,
      bypassedBody.amount,
      "Transaction amount changed unexpectedly"
    );

    assert.equal(
      approvedBody.currency,
      bypassedBody.currency,
      "Currency changed unexpectedly"
    );

    assert.deepEqual(
      approvedBody.tools,
      bypassedBody.tools,
      "Tool sequence or tool arguments changed unexpectedly"
    );

    assert.notDeepEqual(
      approvedBody.approval,
      bypassedBody.approval,
      "Approval evidence did not change"
    );

    /*
     * Calculate both roots using the real SDK.
     */
    const rootCalculator = EGA.init({
      appName: APP_NAME,
      telemetry: false,
      failClosed: true,
      policyId: POLICY_ID,
      approvalThreshold: 70
    });

    const approvedReplayRoot =
      rootCalculator.replayRoot(
        createEnvelope(approvedBody)
      );

    const bypassedReplayRoot =
      rootCalculator.replayRoot(
        createEnvelope(bypassedBody)
      );

    assert.notEqual(
      approvedReplayRoot,
      bypassedReplayRoot,
      "Approval bypass did not change the Replay Root"
    );

    const approvedRuns = [];
    const bypassedRuns = [];

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

      bypassedRuns.push(
        runScenario({
          body: bypassedBody,
          expectedReplayRoot:
            approvedReplayRoot,
          attackType:
            "approval-bypass"
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
          run.context?.containment
            .activated === false &&
          run.context?.containment
            .executionAllowed === true &&
          run.nextCalled === true &&
          run.nextCallCount === 1 &&
          run.response.statusCode === 200 &&
          run.eventCounts[
            "replay.mismatch"
          ] === 0 &&
          run.eventCounts[
            "approval.required"
          ] === 0 &&
          run.eventCounts[
            "execution.blocked"
          ] === 0
      );

    const bypassedPassCount =
      countMatchingRuns(
        bypassedRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.detection
            .expectedReplayRoot ===
            approvedReplayRoot &&
          run.context?.detection
            .actualReplayRoot ===
            bypassedReplayRoot &&
          run.context?.trust
            .approvalRequired === true &&
          run.context?.trust
            .privilegeEscalationGate ===
            true &&
          run.context?.containment
            .activated === true &&
          run.context?.containment
            .mode === "fail-closed" &&
          run.context?.containment
            .executionAllowed === false &&
          run.nextCalled === false &&
          run.nextCallCount === 0 &&
          run.response.statusCode === 409 &&
          run.response.body?.error ===
            "EGA_CONTAINMENT_ACTIVATED" &&
          run.eventCounts[
            "replay.mismatch"
          ] === 1 &&
          run.eventCounts[
            "mutation.detected"
          ] === 1 &&
          run.eventCounts[
            "trust.escalated"
          ] === 1 &&
          run.eventCounts[
            "approval.required"
          ] === 1 &&
          run.eventCounts[
            "privilege.escalation.gated"
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

    const approvedActualRoots =
      uniqueValues(
        approvedRuns.map(
          (run) =>
            run.context.detection
              .actualReplayRoot
        )
      );

    const bypassedActualRoots =
      uniqueValues(
        bypassedRuns.map(
          (run) =>
            run.context.detection
              .actualReplayRoot
        )
      );

    const approvedNextCalledCount =
      countMatchingRuns(
        approvedRuns,
        (run) => run.nextCalled === true
      );

    const bypassedNextCalledCount =
      countMatchingRuns(
        bypassedRuns,
        (run) => run.nextCalled === true
      );

    const bypassedApprovalRequiredCount =
      countMatchingRuns(
        bypassedRuns,
        (run) =>
          run.context?.trust
            .approvalRequired === true
      );

    const bypassedPrivilegeGateCount =
      countMatchingRuns(
        bypassedRuns,
        (run) =>
          run.context?.trust
            .privilegeEscalationGate ===
            true
      );

    const bypassedExecutionDeniedCount =
      countMatchingRuns(
        bypassedRuns,
        (run) =>
          run.context?.containment
            .executionAllowed === false
      );

    const bypassedHttp409Count =
      countMatchingRuns(
        bypassedRuns,
        (run) =>
          run.response.statusCode === 409
      );

    const approvedMismatchEvents =
      totalEvents(
        approvedRuns,
        "replay.mismatch"
      );

    const bypassedMismatchEvents =
      totalEvents(
        bypassedRuns,
        "replay.mismatch"
      );

    const bypassedMutationEvents =
      totalEvents(
        bypassedRuns,
        "mutation.detected"
      );

    const bypassedTrustEscalationEvents =
      totalEvents(
        bypassedRuns,
        "trust.escalated"
      );

    const bypassedApprovalEvents =
      totalEvents(
        bypassedRuns,
        "approval.required"
      );

    const bypassedPrivilegeGateEvents =
      totalEvents(
        bypassedRuns,
        "privilege.escalation.gated"
      );

    const bypassedQuarantineEvents =
      totalEvents(
        bypassedRuns,
        "quarantine.created"
      );

    const bypassedContainmentEvents =
      totalEvents(
        bypassedRuns,
        "containment.activated"
      );

    const bypassedBlockedEvents =
      totalEvents(
        bypassedRuns,
        "execution.blocked"
      );

    /*
     * Hard assertions.
     */
    assert.equal(
      approvedPassCount,
      REPEAT_COUNT,
      "Legitimately approved workflow did not pass all executions"
    );

    assert.equal(
      bypassedPassCount,
      REPEAT_COUNT,
      "Approval-bypass mutation was not blocked in all executions"
    );

    assert.equal(
      approvedActualRoots.length,
      1,
      "Approved Replay Root was not stable"
    );

    assert.equal(
      bypassedActualRoots.length,
      1,
      "Bypassed Replay Root was not stable"
    );

    assert.equal(
      approvedActualRoots[0],
      approvedReplayRoot,
      "Approved runtime root differs from direct SDK root"
    );

    assert.equal(
      bypassedActualRoots[0],
      bypassedReplayRoot,
      "Bypassed runtime root differs from direct SDK root"
    );

    assert.notEqual(
      approvedActualRoots[0],
      bypassedActualRoots[0],
      "Approved and bypassed workflows produced the same Replay Root"
    );

    assert.equal(
      approvedMismatchEvents,
      0,
      "Approved workflow produced false mismatch events"
    );

    assert.equal(
      bypassedMismatchEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one replay.mismatch event per execution"
    );

    assert.equal(
      bypassedMutationEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one mutation.detected event per execution"
    );

    assert.equal(
      bypassedTrustEscalationEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one trust.escalated event per execution"
    );

    assert.equal(
      bypassedApprovalEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one approval.required event per execution"
    );

    assert.equal(
      bypassedPrivilegeGateEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one privilege gate event per execution"
    );

    assert.equal(
      bypassedQuarantineEvents,
      REPEAT_COUNT,
      "Approval bypass must create one quarantine record per execution"
    );

    assert.equal(
      bypassedContainmentEvents,
      REPEAT_COUNT,
      "Approval bypass must activate containment in every execution"
    );

    assert.equal(
      bypassedBlockedEvents,
      REPEAT_COUNT,
      "Approval bypass must generate one execution.blocked event per execution"
    );

    assert.equal(
      bypassedNextCalledCount,
      0,
      "Fail-closed approval bypass must not call next()"
    );

    assert.equal(
      bypassedHttp409Count,
      REPEAT_COUNT,
      "Approval bypass must return HTTP 409 in all executions"
    );

    const approvedSample =
      summarizeRun(approvedRuns[0]);

    const bypassedSample =
      summarizeRun(bypassedRuns[0]);

    const assertions = {
      workflowIdUnchanged:
        approvedBody.workflowId ===
        bypassedBody.workflowId,

      businessActionUnchanged:
        approvedBody.action ===
        bypassedBody.action,

      amountUnchanged:
        approvedBody.amount ===
        bypassedBody.amount,

      currencyUnchanged:
        approvedBody.currency ===
        bypassedBody.currency,

      toolsUnchanged:
        sameJson(
          approvedBody.tools,
          bypassedBody.tools
        ),

      approvalStateChanged:
        !sameJson(
          approvedBody.approval,
          bypassedBody.approval
        ),

      approvalMutationChangesReplayRoot:
        approvedReplayRoot !==
        bypassedReplayRoot,

      approvedRootStable100:
        approvedActualRoots.length === 1,

      bypassedRootStable100:
        bypassedActualRoots.length === 1,

      approvedMatches100:
        approvedPassCount === REPEAT_COUNT,

      approvedFalsePositivesZero:
        approvedMismatchEvents === 0,

      bypassDetected100:
        bypassedPassCount === REPEAT_COUNT,

      approvalRequired100:
        bypassedApprovalRequiredCount ===
        REPEAT_COUNT,

      privilegeGate100:
        bypassedPrivilegeGateCount ===
        REPEAT_COUNT,

      executionDenied100:
        bypassedExecutionDeniedCount ===
        REPEAT_COUNT,

      replayMismatchEvents100:
        bypassedMismatchEvents ===
        REPEAT_COUNT,

      mutationDetectedEvents100:
        bypassedMutationEvents ===
        REPEAT_COUNT,

      trustEscalatedEvents100:
        bypassedTrustEscalationEvents ===
        REPEAT_COUNT,

      approvalRequiredEvents100:
        bypassedApprovalEvents ===
        REPEAT_COUNT,

      privilegeGateEvents100:
        bypassedPrivilegeGateEvents ===
        REPEAT_COUNT,

      quarantineEvents100:
        bypassedQuarantineEvents ===
        REPEAT_COUNT,

      containmentEvents100:
        bypassedContainmentEvents ===
        REPEAT_COUNT,

      executionBlockedEvents100:
        bypassedBlockedEvents ===
        REPEAT_COUNT,

      failClosedNextCallsZero:
        bypassedNextCalledCount === 0,

      http409Responses100:
        bypassedHttp409Count ===
        REPEAT_COUNT,

      directAndRuntimeRootsConsistent:
        approvedActualRoots[0] ===
          approvedReplayRoot &&
        bypassedActualRoots[0] ===
          bypassedReplayRoot
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    const evidence = {
      schemaVersion:
        "ega-v9.approval-bypass-evidence.v1",

      testId: TEST_ID,

      title:
        "Deterministic Detection and Fail-Closed Prevention of Approval Bypass",

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
        runtimeMode: "fail-closed",
        failClosed: true,
        approvalThreshold: 70,
        repeatCountPerScenario:
          REPEAT_COUNT
      },

      repeatCountPerScenario:
        REPEAT_COUNT,

      totalExecutions:
        REPEAT_COUNT * 2,

      mutationDefinition: {
        type: "approval-bypass",

        description:
          "The workflow retains the same business action, amount, currency, and tools while replacing the sealed human-approval record with self-authorized bypass state.",

        workflowFieldsChanged: 0,
        businessFieldsChanged: 0,
        toolCallsChanged: 0,

        approvalFieldsChanged: [
          "required",
          "status",
          "approvedBy",
          "approvalId",
          "approvalMethod"
        ]
      },

      approvalStates: {
        approved:
          approvedBody.approval,

        bypassed:
          bypassedBody.approval
      },

      replayRoots: {
        approved:
          approvedReplayRoot,

        bypassed:
          bypassedReplayRoot,

        changed:
          approvedReplayRoot !==
          bypassedReplayRoot
      },

      approved: {
        scenario:
          "legitimate-human-approval",

        observed:
          approvedSample,

        matchCount:
          approvedPassCount,

        mismatchCount:
          REPEAT_COUNT -
          approvedPassCount,

        nextCalledCount:
          approvedNextCalledCount,

        stableRoot:
          approvedActualRoots.length === 1,

        uniqueActualRoots:
          approvedActualRoots,

        eventTotals: {
          "replay.mismatch":
            approvedMismatchEvents,

          "mutation.detected":
            totalEvents(
              approvedRuns,
              "mutation.detected"
            ),

          "trust.escalated":
            totalEvents(
              approvedRuns,
              "trust.escalated"
            ),

          "approval.required":
            totalEvents(
              approvedRuns,
              "approval.required"
            ),

          "privilege.escalation.gated":
            totalEvents(
              approvedRuns,
              "privilege.escalation.gated"
            ),

          "containment.activated":
            totalEvents(
              approvedRuns,
              "containment.activated"
            ),

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

      bypassed: {
        scenario:
          "approval-bypass-mutation",

        observed:
          bypassedSample,

        mismatchCount:
          bypassedPassCount,

        approvalRequiredCount:
          bypassedApprovalRequiredCount,

        privilegeGateCount:
          bypassedPrivilegeGateCount,

        executionDeniedCount:
          bypassedExecutionDeniedCount,

        nextCalledCount:
          bypassedNextCalledCount,

        http409Count:
          bypassedHttp409Count,

        stableRoot:
          bypassedActualRoots.length === 1,

        uniqueActualRoots:
          bypassedActualRoots,

        eventTotals: {
          "replay.mismatch":
            bypassedMismatchEvents,

          "mutation.detected":
            bypassedMutationEvents,

          "trust.escalated":
            bypassedTrustEscalationEvents,

          "approval.required":
            bypassedApprovalEvents,

          "privilege.escalation.gated":
            bypassedPrivilegeGateEvents,

          "quarantine.created":
            bypassedQuarantineEvents,

          "containment.activated":
            bypassedContainmentEvents,

          "execution.blocked":
            bypassedBlockedEvents
        },

        pass:
          bypassedPassCount ===
          REPEAT_COUNT
      },

      assertions,

      scope: {
        included: [
          "sealed approval-state integrity",
          "approval-record mutation detection",
          "Replay Root sensitivity to approval-state changes",
          "trust-state escalation",
          "approval-required event generation",
          "privilege-escalation gating",
          "fail-closed execution prevention",
          "quarantine and containment evidence"
        ],

        excluded: [
          "cryptographic signature validation",
          "human identity authentication",
          "external approval-system availability",
          "authorization-server compromise",
          "operating-system compromise"
        ]
      },

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    console.log(
      "\n=== EGA V9 Approval Bypass Evidence ==="
    );

    console.log(
      `Approved root: ${approvedReplayRoot}`
    );

    console.log(
      `Bypassed root: ${bypassedReplayRoot}`
    );

    console.log(
      `Approved matches: ${approvedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Approved false positives: ${approvedMismatchEvents}`
    );

    console.log(
      `Approval bypasses detected: ${bypassedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Approval required decisions: ${bypassedApprovalRequiredCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Privilege gates: ${bypassedPrivilegeGateCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Execution denied: ${bypassedExecutionDeniedCount}/${REPEAT_COUNT}`
    );

    console.log(
      `approval.required events: ${bypassedApprovalEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `execution.blocked events: ${bypassedBlockedEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `HTTP 409 responses: ${bypassedHttp409Count}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed next() calls: ${bypassedNextCalledCount}`
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
