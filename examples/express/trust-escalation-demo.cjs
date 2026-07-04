const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-6-trust-escalation",
  failClosed: true,
  policyId: "checkout-policy-v1",
  approvalThreshold: 70
});

app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    message: "Trust evaluated",
    ega: req.ega,
    trust: req.ega.trust,
    businessGovernanceProfile: req.ega.businessGovernanceProfile,
    events: ega.events()
  });
});

app.listen(3004, () => {
  console.log("EGA V9 Trust Escalation demo running on http://localhost:3004");
});
