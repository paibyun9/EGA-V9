"use strict";

const assert = require("node:assert/strict");

const {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} = require("ega-v9");

const engine = EGA.init({
  appName: "ega-v9-commonjs-example",
  trustLevel: "verified",
  telemetry: false,
  failClosed: true,
  policyId: "example-policy",
});

const workflow = {
  workflowId: "example-commonjs-workflow",
  action: "purchase",
  amount: 125,
  currency: "USD",
  approved: true,
};

const verification =
  verifyExecution(workflow);

const replayResult =
  replay(workflow);

const provenanceResult =
  provenance(workflow);

const containmentResult =
  contain(workflow);

assert.ok(engine);
assert.ok(ega);
assert.ok(verification);
assert.ok(replayResult);
assert.ok(provenanceResult);
assert.ok(containmentResult);

assert.equal(
  typeof ega.guard,
  "function"
);


console.log(
  "EGA V9 CommonJS Example: PASS"
);

console.log({
  requestId:
    verification.requestId,
  replayRoot:
    verification.replayRoot,
  trustLevel:
    verification.trustLevel,
  status:
    verification.status,
  containmentActivated:
    verification.containment.activated,
  executionAllowed:
    verification.containment.executionAllowed,
  verificationAvailable:
    Boolean(verification),
  replayAvailable:
    Boolean(replayResult),
  provenanceAvailable:
    Boolean(provenanceResult),
  containmentAvailable:
    Boolean(containmentResult),
});
