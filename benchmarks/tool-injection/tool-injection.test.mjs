import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

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
  "tool-injection"
);

const jsonEvidencePath = path.join(
  evidenceDirectory,
  "tool-injection-evidence.json"
);

const markdownEvidencePath = path.join(
  evidenceDirectory,
  "tool-injection-evidence.md"
);

const APP_NAME =
  "ega-v9-tool-injection-evidence";

const POLICY_ID =
  "workflow-tool-injection-policy-v1";

const TEST_ID = "TI-001";
const REPEAT_COUNT = 100;

/*
 * Approved workflow:
 *
 * catalog.search
 * -> catalog.select
 * -> commerce.checkout
 */
const approvedBody = {
  workflowId: "WF-TOOL-INJECTION-001",
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
        productId: "LP-001",
        quantity: 1,
        currency: "USD",
        approved: true
      }
    }
  ]
};

/*
 * Workflow-level Tool Injection:
 *
 * The approved business values and approved tools remain intact.
 * One unapproved external transfer tool is inserted before checkout.
 */
const injectedTool = {
  sequence: 3,
  name: "external.funds.transfer",
  arguments: {
    destinationAccount:
      "UNAPPROVED-DESTINATION",
    amount: 100,
    currency: "USD",
    authorization: "agent-self"
  }
};

const injectedBody = {
  workflowId: "WF-TOOL-INJECTION-001",
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

    injectedTool,

    {
      sequence: 4,
      name: "commerce.checkout",
      arguments: {
        productId: "LP-001",
        quantity: 1,
        currency: "USD",
        approved: true
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

function totalEvents(runs, eventType) {
  return runs.reduce(
    (total, run) =>
      total + run.eventCounts[eventType],
    0
  );
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function countMatchingRuns(runs, predicate) {
  return runs.filter(predicate).length;
}

function toolNames(body) {
  return body.tools.map(
    (tool) => tool.name
  );
}

function normalizeApprovedToolsFromInjected() {
  /*
   * Remove only the injected tool and normalize sequence numbers.
   * The result must equal the approved Tool list.
   */
  return injectedBody.tools
    .filter(
      (tool) =>
        tool.name !== injectedTool.name
    )
    .map((tool, index) => ({
      ...tool,
      sequence: index + 1
    }));
}

function runScenario({
  body,
  expectedReplayRoot,
  attackType
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

      "user-agent":
        "ega-v9-tool-injection-evidence",

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

function summarizeRun(run) {
  return {
    detectionStatus:
      run.context?.detection.status,

    expectedReplayRoot:
      run.context?.detection
        .expectedReplayRoot,

    actualReplayRoot:
      run.context?.detection
        .actualReplayRoot,

    trustTier:
      run.context?.trust.currentTier,

    riskScore:
      run.context?.trust.riskScore,

    approvalRequired:
      run.context?.trust.approvalRequired,

    privilegeEscalationGate:
      run.context?.trust
        .privilegeEscalationGate,

    containmentActivated:
      run.context?.containment.activated,

    containmentMode:
      run.context?.containment.mode,

    executionAllowed:
      run.context?.containment
        .executionAllowed,

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

function createMarkdownEvidence(evidence) {
  return `# EGA V9 Workflow-Level Tool Injection Evidence

## Test Identity

- Evidence schema: \`${evidence.schemaVersion}\`
- Test ID: \`${evidence.testId}\`
- Repetitions per scenario: ${evidence.repeatCountPerScenario}
- Total executions: ${evidence.totalExecutions}
- SDK entry point: \`${evidence.sdkEntryPoint}\`
- Runtime mode: \`${evidence.configuration.runtimeMode}\`

## Threat Definition

The attack preserves the approved workflow ID, business action,
amount, currency, and all originally approved tools.

It injects one additional unapproved Tool into the workflow before
the approved checkout operation.

## Approved Tool Sequence

\`${evidence.toolSequences.approved.join(" → ")}\`

## Injected Tool Sequence

\`${evidence.toolSequences.injected.join(" → ")}\`

## Injected Tool

- Name: \`${evidence.injectedTool.name}\`
- Destination: \`${evidence.injectedTool.arguments.destinationAccount}\`
- Authorization: \`${evidence.injectedTool.arguments.authorization}\`

## Results

| Scenario | Detection | Execution allowed | next() calls | HTTP status | Result |
|---|---:|---:|---:|---:|---:|
| Approved workflow | ${evidence.approved.observed.detectionStatus} | ${evidence.approved.observed.executionAllowed} | ${evidence.approved.nextCalledCount}/${evidence.repeatCountPerScenario} | ${evidence.approved.observed.statusCode} | ${evidence.approved.pass ? "PASS" : "FAIL"} |
| Tool-injected workflow | ${evidence.injected.observed.detectionStatus} | ${evidence.injected.observed.executionAllowed} | ${evidence.injected.nextCalledCount}/${evidence.repeatCountPerScenario} | ${evidence.injected.observed.statusCode} | ${evidence.injected.pass ? "PASS" : "FAIL"} |

## Replay Roots

- Approved Replay Root: \`${evidence.replayRoots.approved}\`
- Injected Replay Root: \`${evidence.replayRoots.injected}\`
- Roots differ: \`${evidence.replayRoots.changed}\`

## Governance Events

| Event | Approved workflow | Injected workflow |
|---|---:|---:|
| \`replay.mismatch\` | ${evidence.approved.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["replay.mismatch"]}/${evidence.repeatCountPerScenario} |
| \`mutation.detected\` | ${evidence.approved.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["mutation.detected"]}/${evidence.repeatCountPerScenario} |
| \`trust.escalated\` | ${evidence.approved.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["trust.escalated"]}/${evidence.repeatCountPerScenario} |
| \`approval.required\` | ${evidence.approved.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["approval.required"]}/${evidence.repeatCountPerScenario} |
| \`privilege.escalation.gated\` | ${evidence.approved.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["privilege.escalation.gated"]}/${evidence.repeatCountPerScenario} |
| \`quarantine.created\` | ${evidence.approved.eventTotals["quarantine.created"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["quarantine.created"]}/${evidence.repeatCountPerScenario} |
| \`containment.activated\` | ${evidence.approved.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["containment.activated"]}/${evidence.repeatCountPerScenario} |
| \`execution.blocked\` | ${evidence.approved.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} | ${evidence.injected.eventTotals["execution.blocked"]}/${evidence.repeatCountPerScenario} |

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

TI-001 demonstrates that inserting one unapproved Tool into an
otherwise unchanged approved workflow changes the deterministic
Replay Root and prevents downstream execution under fail-closed mode.

## Scope Boundary

This evidence tests Tool insertion at the workflow-data and runtime
governance level. It does not test prompt-injection detection inside
a language model, model-weight compromise, or operating-system
compromise.
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
  "Workflow-Level Tool Injection evidence: an unapproved inserted Tool changes the Replay Root and is blocked",
  async () => {
    assert.equal(
      typeof EGA,
      "function",
      "EGA must be exported by the built SDK"
    );

    /*
     * Structural preconditions:
     *
     * The attack must preserve business values and the original
     * approved tools. Exactly one Tool must be added.
     */
    assert.equal(
      approvedBody.workflowId,
      injectedBody.workflowId,
      "Workflow ID changed unexpectedly"
    );

    assert.equal(
      approvedBody.action,
      injectedBody.action,
      "Business action changed unexpectedly"
    );

    assert.equal(
      approvedBody.amount,
      injectedBody.amount,
      "Amount changed unexpectedly"
    );

    assert.equal(
      approvedBody.currency,
      injectedBody.currency,
      "Currency changed unexpectedly"
    );

    assert.equal(
      injectedBody.tools.length,
      approvedBody.tools.length + 1,
      "Exactly one Tool must be injected"
    );

    assert.deepEqual(
      normalizeApprovedToolsFromInjected(),
      approvedBody.tools,
      "The original approved Tools changed unexpectedly"
    );

    assert.equal(
      injectedBody.tools.filter(
        (tool) =>
          tool.name === injectedTool.name
      ).length,
      1,
      "The injected Tool must appear exactly once"
    );

    /*
     * Calculate Replay Roots with the real SDK.
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

    const injectedReplayRoot =
      rootCalculator.replayRoot(
        createEnvelope(injectedBody)
      );

    assert.notEqual(
      approvedReplayRoot,
      injectedReplayRoot,
      "Injected Tool did not change the Replay Root"
    );

    const approvedRuns = [];
    const injectedRuns = [];

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

      injectedRuns.push(
        runScenario({
          body: injectedBody,
          expectedReplayRoot:
            approvedReplayRoot,
          attackType:
            "workflow-tool-injection"
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
            "mutation.detected"
          ] === 0 &&
          run.eventCounts[
            "execution.blocked"
          ] === 0
      );

    const injectedPassCount =
      countMatchingRuns(
        injectedRuns,
        (run) =>
          run.context?.detection.status ===
            "mismatch" &&
          run.context?.detection
            .expectedReplayRoot ===
            approvedReplayRoot &&
          run.context?.detection
            .actualReplayRoot ===
            injectedReplayRoot &&
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

    const injectedActualRoots =
      uniqueValues(
        injectedRuns.map(
          (run) =>
            run.context.detection
              .actualReplayRoot
        )
      );

    const approvedNextCalledCount =
      countMatchingRuns(
        approvedRuns,
        (run) => run.nextCalled
      );

    const injectedNextCalledCount =
      countMatchingRuns(
        injectedRuns,
        (run) => run.nextCalled
      );

    const injectedExecutionDeniedCount =
      countMatchingRuns(
        injectedRuns,
        (run) =>
          run.context?.containment
            .executionAllowed === false
      );

    const injectedHttp409Count =
      countMatchingRuns(
        injectedRuns,
        (run) =>
          run.response.statusCode === 409
      );

    const approvedMismatchEvents =
      totalEvents(
        approvedRuns,
        "replay.mismatch"
      );

    const injectedMismatchEvents =
      totalEvents(
        injectedRuns,
        "replay.mismatch"
      );

    const injectedMutationEvents =
      totalEvents(
        injectedRuns,
        "mutation.detected"
      );

    const injectedTrustEvents =
      totalEvents(
        injectedRuns,
        "trust.escalated"
      );

    const injectedApprovalEvents =
      totalEvents(
        injectedRuns,
        "approval.required"
      );

    const injectedPrivilegeEvents =
      totalEvents(
        injectedRuns,
        "privilege.escalation.gated"
      );

    const injectedQuarantineEvents =
      totalEvents(
        injectedRuns,
        "quarantine.created"
      );

    const injectedContainmentEvents =
      totalEvents(
        injectedRuns,
        "containment.activated"
      );

    const injectedBlockedEvents =
      totalEvents(
        injectedRuns,
        "execution.blocked"
      );

    /*
     * Hard assertions.
     */
    assert.equal(
      approvedPassCount,
      REPEAT_COUNT,
      "Approved workflow did not pass all executions"
    );

    assert.equal(
      injectedPassCount,
      REPEAT_COUNT,
      "Injected Tool was not detected and blocked in all executions"
    );

    assert.equal(
      approvedActualRoots.length,
      1,
      "Approved Replay Root was not stable"
    );

    assert.equal(
      injectedActualRoots.length,
      1,
      "Injected Replay Root was not stable"
    );

    assert.equal(
      approvedActualRoots[0],
      approvedReplayRoot,
      "Approved runtime root differs from direct SDK root"
    );

    assert.equal(
      injectedActualRoots[0],
      injectedReplayRoot,
      "Injected runtime root differs from direct SDK root"
    );

    assert.equal(
      approvedMismatchEvents,
      0,
      "Approved workflow generated false mismatch events"
    );

    assert.equal(
      injectedMismatchEvents,
      REPEAT_COUNT,
      "Injected workflow must generate replay.mismatch 100 times"
    );

    assert.equal(
      injectedMutationEvents,
      REPEAT_COUNT,
      "Injected workflow must generate mutation.detected 100 times"
    );

    assert.equal(
      injectedTrustEvents,
      REPEAT_COUNT,
      "Injected workflow must generate trust.escalated 100 times"
    );

    assert.equal(
      injectedApprovalEvents,
      REPEAT_COUNT,
      "Injected workflow must generate approval.required 100 times"
    );

    assert.equal(
      injectedPrivilegeEvents,
      REPEAT_COUNT,
      "Injected workflow must generate privilege gate 100 times"
    );

    assert.equal(
      injectedQuarantineEvents,
      REPEAT_COUNT,
      "Injected workflow must create quarantine 100 times"
    );

    assert.equal(
      injectedContainmentEvents,
      REPEAT_COUNT,
      "Injected workflow must activate containment 100 times"
    );

    assert.equal(
      injectedBlockedEvents,
      REPEAT_COUNT,
      "Injected workflow must generate execution.blocked 100 times"
    );

    assert.equal(
      injectedNextCalledCount,
      0,
      "Fail-closed Tool injection must not call next()"
    );

    assert.equal(
      injectedHttp409Count,
      REPEAT_COUNT,
      "Tool injection must return HTTP 409 in all executions"
    );

    const approvedSample =
      summarizeRun(approvedRuns[0]);

    const injectedSample =
      summarizeRun(injectedRuns[0]);

    const assertions = {
      workflowIdUnchanged:
        approvedBody.workflowId ===
        injectedBody.workflowId,

      businessActionUnchanged:
        approvedBody.action ===
        injectedBody.action,

      amountUnchanged:
        approvedBody.amount ===
        injectedBody.amount,

      currencyUnchanged:
        approvedBody.currency ===
        injectedBody.currency,

      exactlyOneToolInjected:
        injectedBody.tools.length ===
        approvedBody.tools.length + 1,

      originalApprovedToolsPreserved:
        JSON.stringify(
          normalizeApprovedToolsFromInjected()
        ) ===
        JSON.stringify(
          approvedBody.tools
        ),

      injectedToolPresentOnce:
        injectedBody.tools.filter(
          (tool) =>
            tool.name === injectedTool.name
        ).length === 1,

      toolInjectionChangesReplayRoot:
        approvedReplayRoot !==
        injectedReplayRoot,

      approvedRootStable100:
        approvedActualRoots.length === 1,

      injectedRootStable100:
        injectedActualRoots.length === 1,

      approvedMatches100:
        approvedPassCount === REPEAT_COUNT,

      approvedFalsePositivesZero:
        approvedMismatchEvents === 0,

      toolInjectionDetected100:
        injectedPassCount === REPEAT_COUNT,

      executionDenied100:
        injectedExecutionDeniedCount ===
        REPEAT_COUNT,

      replayMismatchEvents100:
        injectedMismatchEvents ===
        REPEAT_COUNT,

      mutationDetectedEvents100:
        injectedMutationEvents ===
        REPEAT_COUNT,

      trustEscalatedEvents100:
        injectedTrustEvents ===
        REPEAT_COUNT,

      approvalRequiredEvents100:
        injectedApprovalEvents ===
        REPEAT_COUNT,

      privilegeGateEvents100:
        injectedPrivilegeEvents ===
        REPEAT_COUNT,

      quarantineEvents100:
        injectedQuarantineEvents ===
        REPEAT_COUNT,

      containmentEvents100:
        injectedContainmentEvents ===
        REPEAT_COUNT,

      executionBlockedEvents100:
        injectedBlockedEvents ===
        REPEAT_COUNT,

      failClosedNextCallsZero:
        injectedNextCalledCount === 0,

      http409Responses100:
        injectedHttp409Count ===
        REPEAT_COUNT,

      directAndRuntimeRootsConsistent:
        approvedActualRoots[0] ===
          approvedReplayRoot &&
        injectedActualRoots[0] ===
          injectedReplayRoot
    };

    const finalPass =
      Object.values(assertions).every(
        (value) => value === true
      );

    const evidence = {
      schemaVersion:
        "ega-v9.workflow-tool-injection-evidence.v1",

      testId: TEST_ID,

      title:
        "Deterministic Detection and Fail-Closed Prevention of Workflow-Level Tool Injection",

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
        type:
          "workflow-tool-injection",

        description:
          "One unapproved external Tool is inserted into an otherwise unchanged approved workflow.",

        businessFieldsChanged: 0,
        approvedToolsRemoved: 0,
        approvedToolsModified: 0,
        injectedToolCount: 1
      },

      injectedTool,

      toolSequences: {
        approved:
          toolNames(approvedBody),

        injected:
          toolNames(injectedBody)
      },

      replayRoots: {
        approved:
          approvedReplayRoot,

        injected:
          injectedReplayRoot,

        changed:
          approvedReplayRoot !==
          injectedReplayRoot
      },

      approved: {
        scenario:
          "approved-workflow",

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

          "quarantine.created":
            totalEvents(
              approvedRuns,
              "quarantine.created"
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

      injected: {
        scenario:
          "workflow-tool-injection",

        observed:
          injectedSample,

        mismatchCount:
          injectedPassCount,

        executionDeniedCount:
          injectedExecutionDeniedCount,

        nextCalledCount:
          injectedNextCalledCount,

        http409Count:
          injectedHttp409Count,

        stableRoot:
          injectedActualRoots.length === 1,

        eventTotals: {
          "replay.mismatch":
            injectedMismatchEvents,

          "mutation.detected":
            injectedMutationEvents,

          "trust.escalated":
            injectedTrustEvents,

          "approval.required":
            injectedApprovalEvents,

          "privilege.escalation.gated":
            injectedPrivilegeEvents,

          "quarantine.created":
            injectedQuarantineEvents,

          "containment.activated":
            injectedContainmentEvents,

          "execution.blocked":
            injectedBlockedEvents
        },

        pass:
          injectedPassCount ===
          REPEAT_COUNT
      },

      assertions,

      scope: {
        included: [
          "workflow-level Tool insertion",
          "approved Tool preservation",
          "Replay Root sensitivity to inserted Tool calls",
          "deterministic mismatch detection",
          "trust-state escalation",
          "privilege gating",
          "quarantine creation",
          "fail-closed execution prevention"
        ],

        excluded: [
          "prompt injection inside an LLM",
          "model-weight compromise",
          "Tool implementation compromise",
          "operating-system compromise",
          "external infrastructure compromise"
        ]
      },

      finalStatus:
        finalPass ? "PASS" : "FAIL"
    };

    await writeEvidence(evidence);

    console.log(
      "\n=== EGA V9 Workflow-Level Tool Injection Evidence ==="
    );

    console.log(
      `Approved tools: ${toolNames(approvedBody).join(" -> ")}`
    );

    console.log(
      `Injected tools: ${toolNames(injectedBody).join(" -> ")}`
    );

    console.log(
      `Injected Tool: ${injectedTool.name}`
    );

    console.log(
      `Approved root: ${approvedReplayRoot}`
    );

    console.log(
      `Injected root: ${injectedReplayRoot}`
    );

    console.log(
      `Approved matches: ${approvedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Approved false positives: ${approvedMismatchEvents}`
    );

    console.log(
      `Tool injections detected: ${injectedPassCount}/${REPEAT_COUNT}`
    );

    console.log(
      `Execution denied: ${injectedExecutionDeniedCount}/${REPEAT_COUNT}`
    );

    console.log(
      `replay.mismatch events: ${injectedMismatchEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `mutation.detected events: ${injectedMutationEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `quarantine.created events: ${injectedQuarantineEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `execution.blocked events: ${injectedBlockedEvents}/${REPEAT_COUNT}`
    );

    console.log(
      `HTTP 409 responses: ${injectedHttp409Count}/${REPEAT_COUNT}`
    );

    console.log(
      `Fail-closed next() calls: ${injectedNextCalledCount}`
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
