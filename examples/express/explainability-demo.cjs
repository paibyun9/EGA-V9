const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-5-explainability",
  failClosed: true,
  policyId: "checkout-policy-v1"
});

app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    message: "Lineage reconstructed",
    ega: req.ega,
    lineage: req.ega.provenance.lineage,
    provenance: req.ega.provenance,
    businessMetrics: req.ega.provenance.businessMetrics,
    events: ega.events()
  });
});

app.listen(3003, () => {
  console.log("EGA V9 Explainability demo running on http://localhost:3003");
});
