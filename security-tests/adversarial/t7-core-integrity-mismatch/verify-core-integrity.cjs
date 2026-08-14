"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const crypto =
  require("node:crypto");

const baselineFile =
  process.argv[2];

const observedRoot =
  process.argv[3];

if (
  !baselineFile ||
  !observedRoot
) {
  console.error(
    "Usage: node verify-core-integrity.cjs " +
    "<baseline.json> <observed-root>"
  );

  process.exit(2);
}

function sha256File(
  filename
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      fs.readFileSync(
        filename
      )
    )
    .digest(
      "hex"
    );
}

const baseline =
  JSON.parse(
    fs.readFileSync(
      baselineFile,
      "utf8"
    )
  );

const results =
  baseline
    .protectedFiles
    .map(
      (entry) => {
        const observedPath =
          path.join(
            observedRoot,
            entry.source
          );

        if (
          !fs.existsSync(
            observedPath
          )
        ) {
          return {
            baselineId:
              baseline.baselineId,

            source:
              entry.source,

            sourceCommit:
              baseline.source
                ?.commit ??
              null,

            expected:
              entry.expected,

            observed:
              null,

            status:
              "VIOLATION",

            violation:
              true,

            reason:
              "PROTECTED_CORE_MISSING",
          };
        }

        const observed =
          sha256File(
            observedPath
          );

        const match =
          observed ===
          entry.expected;

        return {
          baselineId:
            baseline.baselineId,

          source:
            entry.source,

          sourceCommit:
            baseline.source
              ?.commit ??
            null,

          expected:
            entry.expected,

          observed,

          status:
            match
              ? "MATCH"
              : "MISMATCH",

          violation:
            !match,

          reason:
            match
              ? null
              : "PROTECTED_CORE_HASH_MISMATCH",
        };
      }
    );

const violations =
  results.filter(
    (entry) =>
      entry.violation ===
      true
  );

const output = {
  schemaVersion:
    "1.0.0",

  baselineId:
    baseline.baselineId,

  source:
    baseline.source,

  algorithm:
    baseline.algorithm,

  observedRoot,

  status:
    violations.length === 0
      ? "MATCH"
      : "VIOLATION",

  violation:
    violations.length > 0,

  files:
    results,
};

process.stdout.write(
  JSON.stringify(
    output,
    null,
    2
  ) + "\n"
);

process.exitCode =
  violations.length === 0
    ? 0
    : 1;
