import test from "node:test";
import assert from "node:assert/strict";

import { ega } from "../../dist/index.js";

const VALID_WORKFLOW = [
  {
    step: 1,
    action: "checkout_request",
    item: "laptop",
    quantity: 1,
    approved: true
  }
];

const INVALID_EXPECTED_REPLAY_ROOT =
  "negative-test-invalid-replay-root";

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

async function runMiddleware({
  options = {},
  request
}) {
  let nextCalls = 0;
  let nextError;
  let resolveResponse;

  const responseCompleted = new Promise(
    (resolve) => {
      resolveResponse = resolve;
    }
  );

  const response = createResponse((body) => {
    resolveResponse({
      type: "response",
      body
    });
  });

  const middleware = ega.guard(options);

  const middlewarePromise = Promise.resolve(
    middleware(request, response, (error) => {
      nextCalls += 1;
      nextError = error;

      resolveResponse({
        type: "next",
        error
      });
    })
  );

  const completion = await Promise.race([
    responseCompleted,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Negative-path middleware timed out."
          )
        );
      }, 2000);
    })
  ]);

  await middlewarePromise;

  return {
    request,
    response,
    nextCalls,
    nextError,
    completion
  };
}

function baseRequest(overrides = {}) {
  return {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",
    body: {
      workflow: structuredClone(VALID_WORKFLOW)
    },
    query: {},
    params: {},
    headers: {
      host: "localhost"
    },
    ...overrides
  };
}

function assertBlockedFailure(
  result,
  {
    statusCode,
    errorCode
  }
) {
  assert.equal(
    result.nextCalls,
    0,
    "Blocked negative path must not call next()."
  );

  assert.equal(
    result.response.statusCode,
    statusCode
  );

  assert.equal(
    result.response.jsonCalls,
    1,
    "Failure response must be sent exactly once."
  );

  assert.equal(
    result.response.body?.ok,
    false
  );

  assert.equal(
    result.response.body?.error,
    errorCode
  );

  assert.equal(
    result.response.body
      ?.containmentRequired,
    true
  );

  assert.equal(
    result.response.body
      ?.executionAllowed,
    false
  );

  assert.equal(
    typeof result.response.body
      ?.latencyMicroseconds,
    "number"
  );

  assert.ok(
    Number.isFinite(
      result.response.body
        .latencyMicroseconds
    )
  );
}

test(
  "malformed workflow fails closed",
  async () => {
    const request = baseRequest({
      body: {
        workflow: "not-a-workflow"
      }
    });

    const result = await runMiddleware({
      request
    });

    assertBlockedFailure(result, {
      statusCode: 400,
      errorCode: "EGA_INVALID_WORKFLOW"
    });
  }
);

test(
  "empty workflow fails closed",
  async () => {
    const request = baseRequest({
      body: {
        workflow: []
      }
    });

    const result = await runMiddleware({
      request
    });

    assertBlockedFailure(result, {
      statusCode: 400,
      errorCode: "EGA_INVALID_WORKFLOW"
    });
  }
);

test(
  "missing workflow is explicitly blocked",
  async () => {
    const request = baseRequest({
      body: undefined
    });

    const result = await runMiddleware({
      request
    });

    assertBlockedFailure(result, {
      statusCode: 400,
      errorCode: "EGA_WORKFLOW_REQUIRED"
    });
  }
);

test(
  "workflow resolver exception blocks execution",
  async () => {
    const request = baseRequest();

    const result = await runMiddleware({
      request,
      options: {
        resolveWorkflow() {
          throw new Error(
            "resolver intentionally failed"
          );
        }
      }
    });

    assertBlockedFailure(result, {
      statusCode: 500,
      errorCode: "EGA_GUARD_FAILURE"
    });

    assert.match(
      result.response.body.message,
      /resolver intentionally failed/
    );
  }
);

test(
  "invalid policy configuration is explicitly blocked",
  async () => {
    const request = baseRequest();

    const result = await runMiddleware({
      request,
      options: {
        policyId: "   "
      }
    });

    assertBlockedFailure(result, {
      statusCode: 400,
      errorCode: "EGA_INVALID_POLICY"
    });
  }
);

test(
  "fail-closed mismatch never calls next",
  async () => {
    let onVerifiedCalls = 0;
    let onContainedCalls = 0;

    const request = baseRequest({
      headers: {
        host: "localhost",
        "x-ega-expected-replay-root":
          INVALID_EXPECTED_REPLAY_ROOT
      }
    });

    const result = await runMiddleware({
      request,
      options: {
        mode: "fail-closed",

        onVerified() {
          onVerifiedCalls += 1;
        },

        onContained() {
          onContainedCalls += 1;
        }
      }
    });

    assert.equal(result.nextCalls, 0);
    assert.equal(result.response.statusCode, 403);

    assert.equal(
      result.request.ega?.detection.status,
      "mismatch"
    );

    assert.equal(
      result.request.ega?.containment.mode,
      "fail-closed"
    );

    assert.equal(
      result.request.ega?.containment
        .executionAllowed,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.containmentRequired,
      true
    );

    assert.equal(
      result.request.egaDecision
        ?.executionAllowed,
      false
    );

    assert.equal(onVerifiedCalls, 0);
    assert.equal(onContainedCalls, 1);
  }
);

test(
  "observe mode records mismatch but allows next",
  async () => {
    let onVerifiedCalls = 0;
    let onContainedCalls = 0;

    const request = baseRequest({
      headers: {
        host: "localhost",
        "x-ega-expected-replay-root":
          INVALID_EXPECTED_REPLAY_ROOT
      }
    });

    const result = await runMiddleware({
      request,
      options: {
        mode: "observe",

        onVerified() {
          onVerifiedCalls += 1;
        },

        onContained() {
          onContainedCalls += 1;
        }
      }
    });

    assert.equal(
      result.completion.type,
      "next"
    );

    assert.equal(
      result.nextCalls,
      1,
      "Observe mode must call next() once."
    );

    assert.equal(
      result.nextError,
      undefined
    );

    assert.equal(
      result.response.statusCode,
      200
    );

    assert.equal(
      result.response.jsonCalls,
      0,
      "Observe mode must not send a blocking response."
    );

    assert.equal(
      result.request.ega?.status,
      "contained"
    );

    assert.equal(
      result.request.ega?.detection.status,
      "mismatch"
    );

    assert.equal(
      result.request.ega?.containment
        .activated,
      true
    );

    assert.equal(
      result.request.ega?.containment.mode,
      "observe"
    );

    assert.equal(
      result.request.ega?.containment
        .executionAllowed,
      true
    );

    assert.equal(
      result.request.egaDecision?.verified,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.containmentRequired,
      false
    );

    assert.equal(
      result.request.egaDecision
        ?.executionAllowed,
      true
    );

    assert.equal(
      result.request.egaDecision?.trustState,
      "T3"
    );

    assert.equal(onVerifiedCalls, 0);
    assert.equal(onContainedCalls, 1);
  }
);
