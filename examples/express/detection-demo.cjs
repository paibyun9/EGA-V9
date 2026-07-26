const express = require("express");
const { EGA } = require("ega-v9");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-3-express-detection",
  failClosed: false
});

app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    ega: req.ega,
    events: ega.events()
  });
});

app.listen(3001, () => {
  console.log("EGA V9 Detection demo running on http://localhost:3001");
});
