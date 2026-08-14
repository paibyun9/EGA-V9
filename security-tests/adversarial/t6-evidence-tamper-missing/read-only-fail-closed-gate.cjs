"use strict";

const fs =
  require("node:fs");

const evidencePath =
  process.env.T6_EVIDENCE_PATH;

if (!evidencePath) {
  console.error(
    "T6_EVIDENCE_PATH is required."
  );

  process.exit(2);
}

const evidence = JSON.parse(
  fs.readFileSync(
    evidencePath,
    "utf8"
  )
);

const checks = [
  {
    name:
      "Evidence final status",
    pass:
      evidence.finalStatus ===
      "PASS",
  },
  {
    name:
      "Normal execution reaches downstream",
    pass:
      evidence.normal
        ?.downstreamCalls === 1,
  },
  {
    name:
      "Fail-closed suppresses next",
    pass:
      evidence.failClosed
        ?.nextCalls === 0,
  },
  {
    name:
      "Fail-closed suppresses downstream",
    pass:
      evidence.failClosed
        ?.downstreamCalls === 0,
  },
  {
    name:
      "Fail-closed suppresses purchase",
    pass:
      evidence.failClosed
        ?.purchaseCalls === 0,
  },
  {
    name:
      "Fail-closed suppresses tools",
    pass:
      evidence.failClosed
        ?.toolCalls === 0,
  },
  {
    name:
      "Fail-closed returns HTTP 409",
    pass:
      evidence.failClosed
        ?.statusCode === 409,
  },
  {
    name:
      "Execution decision is denied",
    pass:
      evidence.failClosed
        ?.executionAllowed === false,
  },
  {
    name:
      "All repeated attacks blocked",
    pass:
      evidence.repeatedFailClosed
        ?.blockedRuns ===
      evidence.repeatCount,
  },
  {
    name:
      "Repeated side effects remain zero",
    pass:
      evidence.repeatedFailClosed
        ?.totalDownstreamCalls === 0 &&
      evidence.repeatedFailClosed
        ?.totalPurchaseCalls === 0 &&
      evidence.repeatedFailClosed
        ?.totalToolCalls === 0,
  },
  {
    name:
      "Observe mode remains distinct",
    pass:
      evidence.observe
        ?.downstreamCalls === 1 &&
      evidence.observe
        ?.executionAllowed === true,
  },
];

console.log();

for (const check of checks) {
  console.log(
    `${check.pass ? "✅" : "❌"} ${check.name}`
  );
}

const failed =
  checks.filter(
    (check) => !check.pass
  );

console.log();

if (failed.length > 0) {
  console.error(
    `Fail-Closed Runtime Gate: BLOCKED — ${failed.length} check(s) failed`
  );
  process.exit(1);
}

console.log(
  `Fail-Closed Runtime Gate: PASS — ${checks.length}/${checks.length} checks passed`
);
