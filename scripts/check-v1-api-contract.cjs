"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contractPath = path.join(root, "planning/v1/v1-api-contract.json");
const sourcePath = path.join(root, "packages/sdk-ts/src/index.ts");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✅ ${message}`);
}

if (!fs.existsSync(contractPath)) {
  fail("v1 API contract manifest exists");
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  fail("SDK source exists");
  process.exit(1);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const source = fs.readFileSync(sourcePath, "utf8");

console.log("\nEGA V9 v1 API Contract Check\n");

for (const name of contract.preserve_exports) {
  const patterns = [
    new RegExp(`export\\s+class\\s+${name}\\b`),
    new RegExp(`export\\s+function\\s+${name}\\b`),
    new RegExp(`export\\s+const\\s+${name}\\b`)
  ];

  if (patterns.some((pattern) => pattern.test(source))) {
    pass(`Existing public API preserved: ${name}`);
  } else {
    fail(`Missing existing public API: ${name}`);
  }
}

for (const name of contract.add_exports) {
  const patterns = [
    new RegExp(`export\\s+const\\s+${name}\\b`),
    new RegExp(`export\\s+class\\s+${name}\\b`),
    new RegExp(`export\\s+function\\s+${name}\\b`)
  ];

  if (patterns.some((pattern) => pattern.test(source))) {
    pass(`Planned v1 API implemented: ${name}`);
  } else {
    console.log(`⏳ Planned v1 API not implemented yet: ${name}`);
  }
}

if (contract.implementation_status === "not_started") {
  pass("Contract is frozen before implementation");
} else {
  console.log(
    `ℹ️ Implementation status: ${contract.implementation_status}`
  );
}

if (process.exitCode) {
  console.error("\nV1 API Contract Result: FAILED");
} else {
  console.log("\nV1 API Contract Result: BASELINE PASS");
}
