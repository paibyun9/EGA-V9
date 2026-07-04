const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-4-containment",
  failClosed: true
});

app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    message: "Execution allowed",
    ega: req.ega,
    events: ega.events()
  });
});

app.listen(3002, () => {
  console.log("EGA V9 Containment demo running on http://localhost:3002");
});
