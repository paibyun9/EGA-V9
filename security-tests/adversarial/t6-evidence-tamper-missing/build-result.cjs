"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const childProcess =
  require("node:child_process");

const ROOT =
  process.cwd();

const RUN_DIR =
  path.join(
    ROOT,
    "security-tests/adversarial/" +
    "t6-evidence-tamper-missing/" +
    "evidence/attack-runs"
  );

const attacks = [
  "control",
  "missing-file",
  "missing-assertions",
  "false-assertion-pass",
  "execution-tamper-pass",
  "repeated-side-effect-pass",
  "missing-final-status",
  "truncated-json",
];

function readExit(
  attack,
  gate
) {
  const filename =
    path.join(
      RUN_DIR,
      `${attack}.${gate}.exit.txt`
    );

  if (!fs.existsSync(filename)) {
    return null;
  }

  const value =
    Number(
      fs.readFileSync(
        filename,
        "utf8"
      ).trim()
    );

  return Number.isInteger(value)
    ? value
    : null;
}

function readText(
  attack,
  gate,
  stream
) {
  const filename =
    path.join(
      RUN_DIR,
      `${attack}.${gate}.${stream}.txt`
    );

  if (!fs.existsSync(filename)) {
    return null;
  }

  return fs.readFileSync(
    filename,
    "utf8"
  );
}

const results = {};

for (
  const attack
  of attacks
) {
  results[attack] = {
    failClosedGate: {
      exitCode:
        readExit(
          attack,
          "fail-closed"
        ),

      stdout:
        readText(
          attack,
          "fail-closed",
          "stdout"
        ),

      stderr:
        readText(
          attack,
          "fail-closed",
          "stderr"
        ),
    },

    sevenTestBaseline: {
      exitCode:
        readExit(
          attack,
          "seven-test"
        ),

      stdout:
        readText(
          attack,
          "seven-test",
          "stdout"
        ),

      stderr:
        readText(
          attack,
          "seven-test",
          "stderr"
        ),
    },
  };
}

const controlAccepted =
  results.control
    ?.failClosedGate
    ?.exitCode ===
    0;

const attacked =
  attacks.filter(
    (name) =>
      name !==
      "control"
  );

const failClosedFalseSuccesses =
  attacked.filter(
    (name) =>
      results[name]
        ?.failClosedGate
        ?.exitCode ===
        0
  );

const sevenTestFalseSuccesses =
  attacked.filter(
    (name) =>
      results[name]
        ?.sevenTestBaseline
        ?.exitCode ===
        0
  );

const sourceCommit =
  childProcess
    .execFileSync(
      "git",
      [
        "rev-parse",
        "HEAD",
      ],
      {
        encoding:
          "utf8",
      }
    )
    .trim();

const rawResult = {
  testId:
    "T6-evidence-tamper-missing",

  generatedAt:
    new Date()
      .toISOString(),

  sourceCommit,

  scope:
    "IN_SCOPE",

  control: {
    canonicalEvidenceAccepted:
      controlAccepted,
  },

  attacks:
    results,

  metrics: {
    attackCount:
      attacked.length,

    failClosedFalseSuccessCount:
      failClosedFalseSuccesses
        .length,

    failClosedFalseSuccesses,

    sevenTestFalseSuccessCount:
      sevenTestFalseSuccesses
        .length,

    sevenTestFalseSuccesses,
  },

  classification:
    "NOT_VERIFIED",
};

const out =
  path.join(
    ROOT,
    "security-tests/adversarial/" +
    "t6-evidence-tamper-missing/" +
    "evidence/t6-raw-result.json"
  );

fs.writeFileSync(
  out,
  JSON.stringify(
    rawResult,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    rawResult,
    null,
    2
  )
);
