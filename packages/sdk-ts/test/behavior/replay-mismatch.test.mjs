import test from "node:test";
import assert from "node:assert/strict";

import { ega } from "../../dist/index.js";

const MUTATED_WORKFLOW = [
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
  "deliberately-invalid-replay-root";

function createResponse(onJson) {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,

    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] =
        String(value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      onJson(body);
    }
  };
}

async function runReplayMismatch() {
  let nextCalls = 0;
  let onVerifiedCalls = 0;
  let onContainedCalls = 0;
  let containedDecision;

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
    statusCode: 403,

    onVerified() {
      onVerifiedCalls += 1;
    },

    onContained(decision) {
      onContainedCalls += 1;
      containedDecision = decision;
    }
  });

  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",

    body: {
      workflow: structuredClone(MUTATED_WORKFLOW)
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
        "Replay mismatch test timed out before containment response."
      )
    );
  }, 2000);

  try {
    await middleware(request, response, (error) => {
      nextCalls += 1;

      if (error) {
        rejectResponse(error);
        return;
      }

      rejectResponse(
        new Error(
          "Replay mismatch must not call next()."
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
    containedDecision
  };
}

test(
  "replay mismatch is detected and fail-closed contained",
  async () => {
    const result = await runReplayMismatch();

    assert.equal(
      result.nextCalls,
      0,
      "Replay mismatch must never call next()."
    );

    assert.equal(
      result.response.statusCode,
      403,
      "Replay mismatch must return HTTP 403."
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
      "Containment response must use the expected error code."
    );

    assert.ok(
      result.request.ega,
      "Full verification evidence must exist at req.ega."
    );

    assert.ok(
      result.request.egaDecision,
      "Containment decision must exist at req.egaDecision."
    );

    assert.equal(
      result.request.ega.status,
      "contained",
      "Replay mismatch status must be contained."
    );

    assert.equal(
      result.request.ega.detection.status,
      "mismatch",
      "Replay detection must report mismatch."
    );

    assert.equal(
      result.request.ega.detection.expectedReplayRoot,
      INVALID_EXPECTED_REPLAY_ROOT,
      "Expected replay root must be preserved in evidence."
    );

    assert.notEqual(
      result.request.ega.detection.actualReplayRoot,
      INVALID_EXPECTED_REPLAY_ROOT,
      "Actual replay root must differ from the invalid expected root."
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
      result.request.ega.containment.executionAllowed,
      false,
      "Contained execution must not be allowed."
    );

    assert.equal(
      result.request.egaDecision.verified,
      false,
      "Mismatch decision must report verified=false."
    );

    assert.equal(
      result.request.egaDecision.containmentRequired,
      true,
      "Mismatch must require containment."
    );

    assert.equal(
      result.request.egaDecision.executionAllowed,
      false,
      "Mismatch decision must block execution."
    );

    assert.equal(
      result.request.egaDecision.reason,
      "replay root mismatch",
      "Mismatch decision must expose the containment reason."
    );

    assert.equal(
      result.request.ega.trust.currentTier,
      "T3",
      "Replay mismatch must escalate trust state to T3."
    );

    assert.equal(
      result.request.ega.trust.approvalRequired,
      true,
      "Replay mismatch must require approval."
    );

    assert.equal(
      result.request.ega.mitreMapping.mapped,
      true,
      "Replay mismatch must produce a security mapping."
    );

    assert.equal(
      result.onVerifiedCalls,
      0,
      "onVerified must not run for a replay mismatch."
    );

    assert.equal(
      result.onContainedCalls,
      1,
      "onContained must run exactly once."
    );

    assert.equal(
      result.containedDecision,
      result.request.egaDecision,
      "onContained must receive the stored decision."
    );

    assert.equal(
      typeof result.request.egaDecision.latencyMicroseconds,
      "number",
      "latencyMicroseconds must be numeric."
    );

    assert.ok(
      Number.isFinite(
        result.request.egaDecision.latencyMicroseconds
      ),
      "latencyMicroseconds must be finite."
    );

    assert.ok(
      result.request.egaDecision.latencyMicroseconds >= 0,
      "latencyMicroseconds must not be negative."
    );

    assert.ok(
      result.response.headers[
        "x-ega-latency-microseconds"
      ],
      "Latency response header must exist."
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
      "Response decision must block execution."
    );

    assert.ok(
      Array.isArray(result.response.body.events),
      "Containment response must include an events array."
    );

    const eventTypes =
      result.response.body.events.map(
        (event) => event.type
      );

    assert.ok(
      eventTypes.includes("replay.mismatch"),
      "Evidence must contain replay.mismatch."
    );

    assert.ok(
      eventTypes.includes("mutation.detected"),
      "Evidence must contain mutation.detected."
    );

    assert.ok(
      eventTypes.includes("containment.activated"),
      "Evidence must contain containment.activated."
    );

    assert.ok(
      eventTypes.includes("execution.blocked"),
      "Evidence must contain execution.blocked."
    );
  }
);

test(
  "identical mutated workflows are consistently contained",
  async () => {
    const first = await runReplayMismatch();
    const second = await runReplayMismatch();

    assert.equal(first.nextCalls, 0);
    assert.equal(second.nextCalls, 0);

    assert.equal(first.response.statusCode, 403);
    assert.equal(second.response.statusCode, 403);

    assert.equal(
      first.request.ega.detection.status,
      "mismatch"
    );

    assert.equal(
      second.request.ega.detection.status,
      "mismatch"
    );

    assert.equal(
      first.request.ega.replayRoot,
      second.request.ega.replayRoot,
      "Identical mutated workflows must produce the same actual replay root."
    );

    assert.equal(
      first.request.egaDecision.containmentRequired,
      true
    );

    assert.equal(
      second.request.egaDecision.containmentRequired,
      true
    );

    assert.equal(
      first.request.egaDecision.executionAllowed,
      false
    );

    assert.equal(
      second.request.egaDecision.executionAllowed,
      false
    );
  }
);
