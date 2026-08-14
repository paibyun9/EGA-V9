"use strict";

const fs =
  require("node:fs");

const baseline =
  JSON.parse(
    fs.readFileSync(
      "security-tests/adversarial/" +
      "t7-core-integrity-mismatch/" +
      "evidence/protected-core-baseline.json",
      "utf8"
    )
  );

const result =
  JSON.parse(
    fs.readFileSync(
      "security-tests/adversarial/" +
      "t7-core-integrity-mismatch/" +
      "evidence/t7-raw-result.json",
      "utf8"
    )
  );

const targetSource =
  "packages/sdk-ts/src/index.ts";

const expectedEntry =
  baseline.protectedFiles.find(
    (entry) =>
      entry.source ===
      targetSource
  );

const observedEntry =
  result.files.find(
    (entry) =>
      entry.source ===
      targetSource
  );

const checks = {
  violationStatus:
    result.status ===
      "VIOLATION",

  fileMismatch:
    observedEntry
      ?.status ===
      "MISMATCH",

  violationTrue:
    observedEntry
      ?.violation ===
      true,

  expectedPreserved:
    observedEntry
      ?.expected ===
      expectedEntry
        ?.expected,

  observedPresent:
    typeof observedEntry
      ?.observed ===
      "string" &&
    observedEntry
      .observed.length ===
      64,

  expectedObservedDiffer:
    observedEntry
      ?.expected !==
      observedEntry
        ?.observed,

  sourcePreserved:
    observedEntry
      ?.source ===
      targetSource,

  sourceCommitPreserved:
    observedEntry
      ?.sourceCommit ===
      baseline.source
        ?.commit,

  baselineIdPreserved:
    observedEntry
      ?.baselineId ===
      baseline.baselineId,
};

const allPassed =
  Object.values(
    checks
  ).every(
    Boolean
  );

const output = {
  testId:
    "T7-core-integrity-mismatch",

  checks,

  backbone: {
    mismatchDetection:
      checks.fileMismatch
        ? "VERIFIED"
        : "NOT_VERIFIED",

    violationClassification:
      checks.violationStatus &&
      checks.violationTrue
        ? "VERIFIED"
        : "NOT_VERIFIED",

    expectedPreservation:
      checks.expectedPreserved
        ? "VERIFIED"
        : "NOT_VERIFIED",

    observedPreservation:
      checks.observedPresent &&
      checks.expectedObservedDiffer
        ? "VERIFIED"
        : "NOT_VERIFIED",

    sourcePreservation:
      checks.sourcePreserved &&
      checks.sourceCommitPreserved &&
      checks.baselineIdPreserved
        ? "VERIFIED"
        : "NOT_VERIFIED",
  },

  classification:
    allPassed
      ? "PASS"
      : "FAIL",
};

const out =
  "security-tests/adversarial/" +
  "t7-core-integrity-mismatch/" +
  "evidence/t7-classified-result.json";

fs.writeFileSync(
  out,
  JSON.stringify(
    output,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    output,
    null,
    2
  )
);
