const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init();
app.use(ega.guard());

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    ega: req.ega
  });
});

app.listen(3000, () => {
  console.log("EGA V9 Express demo running on http://localhost:3000");
});
