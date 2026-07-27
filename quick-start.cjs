const { verifyExecution } = require("ega-v9");

const workflow = [
  {
    step: 1,
    action: "search_product",
    item: "Laptop"
  },
  {
    step: 2,
    action: "checkout_request"
  }
];

const result = verifyExecution(workflow);

console.log({
  status: result.status,
  trustState: result.trust.currentTier,
  executionAllowed: result.containment.executionAllowed,
  containmentActivated: result.containment.activated
});