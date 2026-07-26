import {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} from "ega-v9";

const engine = EGA.init({
  appName: "ega-v9-typescript-example",
  trustLevel: "verified",
  telemetry: false,
  failClosed: true,
  policyId: "example-policy",
});

const workflow = {
  workflowId:
    "example-typescript-workflow",
  action:
    "tool-call",
  tool:
    "inventory.lookup",
  arguments: {
    productId: "PRODUCT-001",
  },
};

const verification =
  verifyExecution(workflow);

const replayResult =
  replay(workflow);

const provenanceResult =
  provenance(workflow);

const containmentResult =
  contain(workflow);

if (!engine) {
  throw new Error(
    "EGA initialization failed."
  );
}

if (
  typeof ega.guard !==
  "function"
) {
  throw new Error(
    "ega.guard is not available."
  );
}

if (
  !verification ||
  !replayResult ||
  !provenanceResult ||
  !containmentResult
) {
  throw new Error(
    "One or more EGA operations failed."
  );
}


console.log(
  "EGA V9 TypeScript Example: PASS"
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
