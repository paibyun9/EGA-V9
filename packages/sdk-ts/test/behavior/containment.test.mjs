import test from "node:test";
import assert from "node:assert/strict";

import { ega } from "../../dist/index.js";

const POLICY_VIOLATING_WORKFLOW = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    item: "laptop",
    quantity: 999
  },
  {
    step: 3,
    action: "checkout_request",
    item: "laptop",
    quantity: 999,
    approved: true
  }
];

const INVALID_EXPECTED_REPLAY_ROOT =
  "containment-test-invalid-replay-root";

function createResponse(onJson = () => {}) {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    jsonCalls: 0,

    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] =
        String(value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.jsonCalls += 1;
      this.body = body;
      onJson(body);
    }
  };
}

async function runContainedWorkflow({
  statusCode = 403
} = {}) {
  let nextCalls = 0;
  let onVerifiedCalls = 0;
  let onContainedCalls = 0;
  let callbackDecision;

  let resolveResponse;
  let rejectResponse;

  const responseCompleted = new Promise(
    (resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    }
  );

  const middleware = ega.guard({
    mode: "fail-closed",
    statusCode,

    onVerified() {
      onVerifiedCalls += 1;
    },

    onContained(decision) {
      onContainedCalls += 1;
      callbackDecision = decision;
    }
  });

  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",

    body: {
      workflow: structuredClone(
        POLICY_VIOLATING_WORKFLOW
      )
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",
      "x-ega-expected-replay-root":
        INVALID_EXPECTED_REPLAY_ROOT
    }
  };

  const response = createResponse((body) => {
    resolveResponse(body);
  });

  const timeout = setTimeout(() => {
    rejectResponse(
      new Error(
        "Containment test timed out before a blocking response was produced."
      )
    );
  }, 2000);

  try {
    await middleware(request, response, (error) => {
      nextCalls += 1;

      rejectResponse(
        error ??
          new Error(
            "Contained workflow must never call next()."
          )
      );
    });

    await responseCompleted;
  } finally {
    clearTimeout(timeout);
  }

  return {
    request,
    response,
    nextCalls,
    onVerifiedCalls,
    onContainedCalls,
    callbackDecision
  };
}

test(
  "fail-closed containment blocks execution completely",
  async () => {
    const result = await runContainedWorkflow();

    assert.equal(
      result.nextCalls,
      0,
      "Contained execution must not call next()."
    );

    assert.equal(
      result.response.statusCode,
      403,
      "Default containment response must use HTTP 403."
    );

    assert.equal(
      result.response.jsonCalls,
      1,
      "Containment response must be sent exactly once."
    );

    assert.ok(
      result.response.body,
      "Containment response body must exist."
    );

    assert.equal(
      result.response.body.ok,
      false,
      "Containment response must report ok=false."
    );

    assert.equal(
      result.response.body.error,
      "EGA_CONTAINMENT_ACTIVATED",
      "Containment response must use the canonical error code."
    );

    assert.ok(
      result.request.ega,
      "Full containment evidence must be stored at req.ega."
    );

    assert.ok(
      result.request.egaDecision,
      "Containment decision must be stored at req.egaDecision."
    );

    assert.equal(
      result.request.ega.status,
      "contained",
      "Governance status must be contained."
    );

    assert.equal(
      result.request.ega.containment.activated,
      true,
      "Containment must be activated."
    );

    assert.equal(
      result.request.ega.containment.mode,
      "fail-closed",
      "Containment mode must be fail-closed."
    );

    assert.equal(
      result.request.ega.containment.reason,
      "replay root mismatch",
      "Containment reason must identify the replay mismatch."
    );

    assert.equal(
      result.request.ega.containment.executionAllowed,
      false,
      "Contained execution must not be allowed."
    );

    assert.equal(
      typeof result.request.ega.containment.quarantineId,
      "string",
      "Containment must create a quarantine ID."
    );

    assert.ok(
      result.request.ega.containment.quarantineId
        .startsWith("q_"),
      "Quarantine ID must use the canonical q_ prefix."
    );

    assert.equal(
      result.request.egaDecision.verified,
      false,
      "Contained decision must report verified=false."
    );

    assert.equal(
      result.request.egaDecision.containmentRequired,
      true,
      "Contained decision must require containment."
    );

    assert.equal(
      result.request.egaDecision.executionAllowed,
      false,
      "Contained decision must prohibit execution."
    );

    assert.equal(
      result.onVerifiedCalls,
      0,
      "onVerified must not run during containment."
    );

    assert.equal(
      result.onContainedCalls,
      1,
      "onContained must run exactly once."
    );

    assert.equal(
      result.callbackDecision,
      result.request.egaDecision,
      "onContained must receive the stored containment decision."
    );

    assert.equal(
      result.response.body.decision?.verified,
      false,
      "Response decision must report verified=false."
    );

    assert.equal(
      result.response.body.decision
        ?.containmentRequired,
      true,
      "Response decision must require containment."
    );

    assert.equal(
      result.response.body.decision
        ?.executionAllowed,
      false,
      "Response decision must prohibit execution."
    );

    assert.equal(
      result.response.body.ega?.containment
        ?.activated,
      true,
      "Response evidence must report active containment."
    );

    assert.equal(
      result.response.body.ega?.containment
        ?.quarantineId,
      result.request.ega.containment.quarantineId,
      "Response and request evidence must share the quarantine ID."
    );

    assert.equal(
      typeof result.request.egaDecision
        .latencyMicroseconds,
      "number",
      "Containment latency must be numeric."
    );

    assert.ok(
      Number.isFinite(
        result.request.egaDecision
          .latencyMicroseconds
      ),
      "Containment latency must be finite."
    );

    assert.ok(
      result.request.egaDecision
        .latencyMicroseconds >= 0,
      "Containment latency must not be negative."
    );
  }
);

test(
  "containment records the complete blocking event sequence",
  async () => {
    const result = await runContainedWorkflow();

    assert.ok(
      Array.isArray(result.response.body.events),
      "Containment response must include an events array."
    );

    const eventTypes =
      result.response.body.events.map(
        (event) => event.type
      );

    const requiredEvents = [
      "replay.mismatch",
      "mutation.detected",
      "trust.escalated",
      "approval.required",
      "quarantine.created",
      "containment.activated",
      "execution.blocked"
    ];

    for (const eventType of requiredEvents) {
      assert.ok(
        eventTypes.includes(eventType),
        `Containment evidence must include ${eventType}.`
      );
    }

    const containmentIndex =
      eventTypes.indexOf(
        "containment.activated"
      );

    const blockedIndex =
      eventTypes.indexOf(
        "execution.blocked"
      );

    assert.ok(
      containmentIndex >= 0,
      "containment.activated must be present."
    );

    assert.ok(
      blockedIndex > containmentIndex,
      "execution.blocked must occur after containment.activated."
    );

    const quarantineEvent =
      result.response.body.events.find(
        (event) =>
          event.type === "quarantine.created"
      );

    assert.equal(
      quarantineEvent?.details?.quarantineId,
      result.request.ega.containment.quarantineId,
      "Quarantine event must reference the active quarantine ID."
    );
  }
);

test(
  "custom containment status code is respected without allowing execution",
  async () => {
    const result = await runContainedWorkflow({
      statusCode: 422
    });

    assert.equal(
      result.response.statusCode,
      422,
      "Configured containment status code must be used."
    );

    assert.equal(
      result.nextCalls,
      0,
      "Custom status code must not permit route execution."
    );

    assert.equal(
      result.request.egaDecision
        .containmentRequired,
      true
    );

    assert.equal(
      result.request.egaDecision
        .executionAllowed,
      false
    );

    assert.equal(
      result.response.body.error,
      "EGA_CONTAINMENT_ACTIVATED"
    );
  }
);

test(
  "separate containment executions receive isolated quarantine IDs",
  async () => {
    const first =
      await runContainedWorkflow();

    const second =
      await runContainedWorkflow();

    assert.equal(first.nextCalls, 0);
    assert.equal(second.nextCalls, 0);

    assert.equal(
      first.request.egaDecision
        .containmentRequired,
      true
    );

    assert.equal(
      second.request.egaDecision
        .containmentRequired,
      true
    );

    assert.notEqual(
      first.request.ega.containment.quarantineId,
      second.request.ega.containment.quarantineId,
      "Separate containment executions must not share a quarantine ID."
    );

    assert.notEqual(
      first.request.ega.requestId,
      second.request.ega.requestId,
      "Separate containment executions must not share a request ID."
    );

    assert.equal(
      first.request.ega.replayRoot,
      second.request.ega.replayRoot,
      "Identical dangerous workflows should retain deterministic replay roots."
    );
  }
);
