"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const crypto =
  require("node:crypto");

const {
  execFileSync,
} = require(
  "node:child_process"
);

const ROOT =
  process.cwd();

const PROTECTED_FILES = [
  "packages/sdk-ts/src/index.ts",

  "packages/sdk-ts/test/runtime-blocking/" +
    "fail-closed-runtime-blocking.test.cjs",

  "packages/sdk-ts/test/behavior/" +
    "containment.test.mjs",

  "packages/sdk-ts/test/behavior/" +
    "trust-state.test.mjs",
];

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

const sourceCommit =
  execFileSync(
    "git",
    [
      "rev-parse",
      "HEAD",
    ],
    {
      cwd:
        ROOT,

      encoding:
        "utf8",
    }
  ).trim();

const baselineId =
  `ega-v9-core-${sourceCommit.slice(0, 12)}`;

const files =
  PROTECTED_FILES.map(
    (relativePath) => {
      const absolutePath =
        path.join(
          ROOT,
          relativePath
        );

      if (
        !fs.existsSync(
          absolutePath
        )
      ) {
        throw new Error(
          `Protected core file missing: ${relativePath}`
        );
      }

      return {
        source:
          relativePath,

        expected:
          sha256File(
            absolutePath
          ),
      };
    }
  );

const baseline = {
  schemaVersion:
    "1.0.0",

  baselineId,

  algorithm:
    "sha256",

  source: {
    type:
      "git-commit",

    commit:
      sourceCommit,
  },

  protectedFiles:
    files,
};

const output =
  path.join(
    ROOT,
    "security-tests/adversarial/" +
      "t7-core-integrity-mismatch/" +
      "evidence/protected-core-baseline.json"
  );

fs.writeFileSync(
  output,
  JSON.stringify(
    baseline,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    baseline,
    null,
    2
  )
);
