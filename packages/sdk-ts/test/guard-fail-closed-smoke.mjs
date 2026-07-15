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
  headers: {
    "x-ega-expected-replay-root":
      "definitely-not-the-actual-replay-root"
  }
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

if (nextCalled) {
  throw new Error(
    "Fail-closed request must not call next()."
  );
}

if (response.statusCode !== 403) {
  throw new Error(
    `Expected HTTP 403, received ${response.statusCode}.`
  );
}

if (!request.egaDecision) {
  throw new Error(
    "Expected containment decision."
  );
}

if (
  request.egaDecision.containmentRequired !== true
) {
  throw new Error(
    "Expected containmentRequired=true."
  );
}

if (
  request.egaDecision.executionAllowed !== false
) {
  throw new Error(
    "Expected executionAllowed=false."
  );
}

console.log("✅ ega.guard() fail-closed smoke test passed");
console.log({
  nextCalled,
  statusCode: response.statusCode,
  containmentRequired:
    request.egaDecision.containmentRequired,
  executionAllowed:
    request.egaDecision.executionAllowed,
  latencyMicroseconds:
    request.egaDecision.latencyMicroseconds
});
