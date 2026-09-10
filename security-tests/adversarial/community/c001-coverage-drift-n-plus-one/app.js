const express = require("express");
const { ega } = require("ega-v9");

const app = express();
app.use(express.json());

let protectedCalls = 0;
let uncoveredCalls = 0;

const guard = ega.guard({
  mode: "fail-closed",
});

app.post(
  "/protected-a",
  guard,
  (req, res) => {
    protectedCalls += 1;
    res.json({
      route: "protected-a",
      protectedCalls,
    });
  }
);

app.post(
  "/protected-b",
  guard,
  (req, res) => {
    protectedCalls += 1;
    res.json({
      route: "protected-b",
      protectedCalls,
    });
  }
);

/*
 * N+1 route intentionally added WITHOUT EGA guard.
 */
app.post(
  "/uncovered-c",
  (req, res) => {
    uncoveredCalls += 1;
    res.json({
      route: "uncovered-c",
      uncoveredCalls,
    });
  }
);

module.exports = {
  app,
  getState() {
    return {
      protectedCalls,
      uncoveredCalls,
    };
  },
};
