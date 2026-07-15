"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const tests = [
  {
    name: "V1 API contract",
    command: "node",
    args: [
      "scripts/check-v1-api-contract.cjs"
    ]
  },
  {
    name: "Normal guard smoke",
    command: "node",
    args: [
      "packages/sdk-ts/test/guard-smoke.mjs"
    ]
  },
  {
    name: "Fail-closed guard smoke",
    command: "node",
    args: [
      "packages/sdk-ts/test/guard-fail-closed-smoke.mjs"
    ]
  },
  {
    name: "Normal workflow behavior",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/normal-workflow.test.mjs"
    ]
  },
  {
    name: "Replay mismatch behavior",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/replay-mismatch.test.mjs"
    ]
  },
  {
    name: "Provenance behavior",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/provenance.test.mjs"
    ]
  },
  {
    name: "Containment behavior",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/containment.test.mjs"
    ]
  },
  {
    name: "Trust-state behavior",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/trust-state.test.mjs"
    ]
  },
  {
    name: "Expanded negative paths",
    command: "node",
    args: [
      "--test",
      "packages/sdk-ts/test/behavior/negative-paths.test.mjs"
    ]
  },
  {
    name: "Express integration",
    command: "node",
    args: [
      "packages/sdk-ts/test/express-guard-integration.mjs"
    ]
  }
];

console.log(
  "\nEGA V9 v1 Official Test Suite\n"
);

let passed = 0;

for (const [index, entry] of tests.entries()) {
  const number = index + 1;

  console.log(
    `\n[${number}/${tests.length}] ${entry.name}`
  );

  const result = spawnSync(
    entry.command,
    entry.args,
    {
      cwd: root,
      stdio: "inherit",
      env: process.env
    }
  );

  if (result.error) {
    console.error(
      `\n❌ ${entry.name} could not start:`
    );
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `\n❌ Official suite failed at: ${entry.name}`
    );
    process.exit(
      typeof result.status === "number"
        ? result.status
        : 1
    );
  }

  passed += 1;

  console.log(
    `✅ ${entry.name} passed`
  );
}

console.log(
  "\nEGA V9 v1 Official Test Suite Result"
);

console.log(
  `✅ PASS — ${passed}/${tests.length} test groups passed`
);
