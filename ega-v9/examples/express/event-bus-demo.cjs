const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-7-event-bus",
  failClosed: true,
  policyId: "checkout-policy-v1",
  approvalThreshold: 70
});

app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    message: "Event bus updated",
    ega: req.ega,
    events: ega.events(),
    latestEvents: ega.latestEvents(5),
    eventSummary: ega.eventSummary()
  });
});

app.get("/events", (req, res) => {
  res.json({
    events: ega.events(),
    latestEvents: ega.latestEvents(10),
    eventSummary: ega.eventSummary()
  });
});

app.get("/events/:type", (req, res) => {
  res.json({
    type: req.params.type,
    events: ega.events(req.params.type),
    eventSummary: ega.eventSummary()
  });
});

app.listen(3005, () => {
  console.log("EGA V9 Event Bus demo running on http://localhost:3005");
});
