import { ega } from "../dist/index.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,

    setHeader(name, value) {
      this.headers[name] = value;
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

const middleware = ega.guard();

const request = {
  method: "POST",
  path: "/checkout",
  body: {
    workflow: [
      {
        step: 1,
        action: "checkout_request",
        approved: true
      }
    ]
  },
  headers: {}
};

const response = createResponse();

let nextCalled = false;

await middleware(request, response, (error) => {
  if (error) {
    throw error;
  }

  nextCalled = true;
});

await new Promise((resolve) => setImmediate(resolve));

if (!nextCalled) {
  throw new Error("Expected next() to be called.");
}

if (!request.ega) {
  throw new Error(
    "Expected full verification evidence at req.ega."
  );
}

if (!request.egaDecision) {
  throw new Error(
    "Expected guard decision at req.egaDecision."
  );
}

if (request.egaDecision.verified !== true) {
  throw new Error(
    "Expected normal request to be verified."
  );
}

if (
  typeof request.egaDecision.latencyMicroseconds !== "number"
) {
  throw new Error(
    "Expected numeric latencyMicroseconds."
  );
}

console.log("✅ ega.guard() normal-request smoke test passed");
console.log({
  nextCalled,
  verified: request.egaDecision.verified,
  containmentRequired:
    request.egaDecision.containmentRequired,
  executionAllowed:
    request.egaDecision.executionAllowed,
  latencyMicroseconds:
    request.egaDecision.latencyMicroseconds
});
