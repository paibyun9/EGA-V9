import test from "node:test";
import assert from "node:assert/strict";

import { ega } from "../../dist/index.js";

const NORMAL_WORKFLOW = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    item: "laptop",
    quantity: 1
  },
  {
    step: 3,
    action: "checkout_request",
    item: "laptop",
    quantity: 1,
    approved: true
  }
];

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,

    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
    }
  };
}

async function runNormalWorkflow() {
  let onVerifiedCalls = 0;
  let onContainedCalls = 0;
  let callbackDecision;

  const middleware = ega.guard({
    mode: "fail-closed",

    onVerified(decision) {
      onVerifiedCalls += 1;
      callbackDecision = decision;
    },

    onContained() {
      onContainedCalls += 1;
    }
  });

  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",
    body: {
      workflow: structuredClone(NORMAL_WORKFLOW)
    },
    query: {},
    params: {},
    headers: {
      host: "localhost"
    }
  };

  const response = createResponse();

  let nextCalls = 0;
  let nextError;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Normal workflow timed out before next() was called."
        )
      );
    }, 2000);

    Promise.resolve(
      middleware(request, response, (error) => {
        nextCalls += 1;
        nextError = error;

        clearTimeout(timeout);
        resolve();
      })
    ).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return {
    request,
    response,
    nextCalls,
    nextError,
    onVerifiedCalls,
    onContainedCalls,
    callbackDecision
  };
}

test(
  "normal workflow is verified and allowed",
  async () => {
    const result = await runNormalWorkflow();

    assert.equal(
      result.nextCalls,
      1,
      "Normal workflow must call next() exactly once."
    );

    assert.equal(
      result.nextError,
      undefined,
      "Normal workflow must not pass an error to next()."
    );

    assert.equal(
      result.response.statusCode,
      200,
      "Normal workflow must not be converted into a blocking response."
    );

    assert.equal(
      result.response.body,
      undefined,
      "Guard must not send a containment body for a normal workflow."
    );

    assert.ok(
      result.request.ega,
      "Full verification evidence must be stored at req.ega."
    );

    assert.ok(
      result.request.egaDecision,
      "Guard decision must be stored at req.egaDecision."
    );

    assert.equal(
      result.request.ega.status,
      "verified",
      "Normal workflow status must be verified."
    );

    assert.equal(
      result.request.ega.detection.status,
      "match",
      "Normal workflow replay detection must be match."
    );

    assert.equal(
      result.request.ega.containment.activated,
      false,
      "Containment must remain inactive."
    );

    assert.equal(
      result.request.ega.containment.executionAllowed,
      true,
      "Normal workflow execution must be allowed."
    );

    assert.equal(
      result.request.egaDecision.verified,
      true,
      "Guard decision must report verified=true."
    );

    assert.equal(
      result.request.egaDecision.containmentRequired,
      false,
      "Normal workflow must not require containment."
    );

    assert.equal(
      result.request.egaDecision.executionAllowed,
      true,
      "Guard decision must allow execution."
    );

    assert.equal(
      result.request.egaDecision.reason,
      null,
      "Normal workflow must not have a containment reason."
    );

    assert.equal(
      result.onVerifiedCalls,
      1,
      "onVerified must run exactly once."
    );

    assert.equal(
      result.onContainedCalls,
      0,
      "onContained must not run for a normal workflow."
    );

    assert.equal(
      result.callbackDecision,
      result.request.egaDecision,
      "onVerified must receive the stored guard decision."
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
      "Latency response header must be present."
    );
  }
);

test(
  "identical normal workflows produce the same replay root",
  async () => {
    const first = await runNormalWorkflow();
    const second = await runNormalWorkflow();

    assert.equal(
      first.request.ega.detection.status,
      "match"
    );

    assert.equal(
      second.request.ega.detection.status,
      "match"
    );

    assert.equal(
      first.request.ega.replayRoot,
      second.request.ega.replayRoot,
      "Identical workflows must produce the same replay root."
    );

    assert.equal(
      first.request.egaDecision.verified,
      true
    );

    assert.equal(
      second.request.egaDecision.verified,
      true
    );
  }
);
