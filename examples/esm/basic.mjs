import assert from "node:assert/strict";

import defaultExport, {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} from "ega-v9";

const engine = EGA.init({
  appName: "ega-v9-esm-example",
  trustLevel: "verified",
  telemetry: false,
  failClosed: true,
  policyId: "example-policy",
});

const workflow = {
  workflowId: "example-esm-workflow",
  action: "refund",
  amount: 75,
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

assert.ok(defaultExport);

assert.equal(
  defaultExport.EGA,
  EGA
);

assert.equal(
  defaultExport.ega,
  ega
);

assert.ok(engine);
assert.ok(verification);
assert.ok(replayResult);
assert.ok(provenanceResult);
assert.ok(containmentResult);

assert.equal(
  typeof ega.guard,
  "function"
);


console.log(
  "EGA V9 ESM Example: PASS"
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
