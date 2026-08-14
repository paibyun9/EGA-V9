"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const {
  spawnSync,
  execFileSync,
} = require(
  "node:child_process"
);

const ROOT =
  process.cwd();

const CANONICAL =
  "/tmp/t6-canonical-fail-closed-runtime-blocking.json";

const GATE =
  path.join(
    ROOT,
    "security-tests/adversarial/" +
    "t6-evidence-tamper-missing/" +
    "read-only-fail-closed-gate.cjs"
  );

const EVIDENCE_DIR =
  path.join(
    ROOT,
    "security-tests/adversarial/" +
    "t6-evidence-tamper-missing/" +
    "evidence"
  );

const ARTIFACT_DIR =
  path.join(
    EVIDENCE_DIR,
    "readonly-attack-artifacts"
  );

const RUN_DIR =
  path.join(
    EVIDENCE_DIR,
    "readonly-attack-runs"
  );

fs.mkdirSync(
  ARTIFACT_DIR,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  RUN_DIR,
  {
    recursive: true,
  }
);

if (
  !fs.existsSync(
    CANONICAL
  )
) {
  throw new Error(
    "Canonical T6 evidence copy is missing."
  );
}

const canonical =
  JSON.parse(
    fs.readFileSync(
      CANONICAL,
      "utf8"
    )
  );

function clone(value) {
  return structuredClone(
    value
  );
}

function writeJson(
  name,
  value
) {
  const file =
    path.join(
      ARTIFACT_DIR,
      `${name}.json`
    );

  fs.writeFileSync(
    file,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );

  return file;
}

function runGate(
  name,
  evidencePath
) {
  const result =
    spawnSync(
      process.execPath,
      [
        GATE,
      ],
      {
        cwd:
          ROOT,

        encoding:
          "utf8",

        env: {
          ...process.env,

          T6_EVIDENCE_PATH:
            evidencePath,
        },
      }
    );

  const exitCode =
    Number.isInteger(
      result.status
    )
      ? result.status
      : 255;

  fs.writeFileSync(
    path.join(
      RUN_DIR,
      `${name}.stdout.txt`
    ),
    result.stdout ?? "",
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      RUN_DIR,
      `${name}.stderr.txt`
    ),
    result.stderr ?? "",
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      RUN_DIR,
      `${name}.exit.txt`
    ),
    `${exitCode}\n`,
    "utf8"
  );

  return {
    name,

    evidencePath,

    exitCode,

    acceptedAsPass:
      exitCode === 0,

    stdout:
      result.stdout ?? "",

    stderr:
      result.stderr ?? "",
  };
}

const results = {};

/*
 * CONTROL
 */

results.control =
  runGate(
    "control",
    CANONICAL
  );

/*
 * ATTACK 1
 * Entire evidence file missing.
 */

const missingFile =
  path.join(
    ARTIFACT_DIR,
    "missing-file.json"
  );

try {
  fs.unlinkSync(
    missingFile
  );
} catch {}

results.missingFile =
  runGate(
    "missing-file",
    missingFile
  );

/*
 * ATTACK 2
 * Required assertions section removed.
 */

{
  const evidence =
    clone(
      canonical
    );

  delete evidence.assertions;

  const file =
    writeJson(
      "missing-assertions",
      evidence
    );

  results.missingAssertions =
    runGate(
      "missing-assertions",
      file
    );
}

/*
 * ATTACK 3
 * Assertion says security property failed,
 * but attacker leaves finalStatus=PASS.
 */

{
  const evidence =
    clone(
      canonical
    );

  evidence.assertions = {
    ...(evidence.assertions ?? {}),

    repeatedSideEffectsZero:
      false,
  };

  evidence.finalStatus =
    "PASS";

  const file =
    writeJson(
      "false-assertion-pass",
      evidence
    );

  results.falseAssertionPass =
    runGate(
      "false-assertion-pass",
      file
    );
}

/*
 * ATTACK 4
 * Actual fail-closed execution data says
 * protected side effects occurred while
 * finalStatus remains PASS.
 */

{
  const evidence =
    clone(
      canonical
    );

  evidence.failClosed = {
    ...(evidence.failClosed ?? {}),

    downstreamCalls:
      1,

    purchaseCalls:
      1,

    toolCalls:
      1,

    executionAllowed:
      true,
  };

  evidence.finalStatus =
    "PASS";

  const file =
    writeJson(
      "execution-tamper-pass",
      evidence
    );

  results.executionTamperPass =
    runGate(
      "execution-tamper-pass",
      file
    );
}

/*
 * ATTACK 5
 * Repeated fail-closed side-effect data
 * changed from zero to one.
 */

{
  const evidence =
    clone(
      canonical
    );

  evidence.repeatedFailClosed = {
    ...(
      evidence
        .repeatedFailClosed ??
      {}
    ),

    totalDownstreamCalls:
      1,

    totalPurchaseCalls:
      1,

    totalToolCalls:
      1,
  };

  evidence.finalStatus =
    "PASS";

  const file =
    writeJson(
      "repeated-side-effect-pass",
      evidence
    );

  results.repeatedSideEffectPass =
    runGate(
      "repeated-side-effect-pass",
      file
    );
}

/*
 * ATTACK 6
 * finalStatus omitted.
 */

{
  const evidence =
    clone(
      canonical
    );

  delete evidence.finalStatus;

  const file =
    writeJson(
      "missing-final-status",
      evidence
    );

  results.missingFinalStatus =
    runGate(
      "missing-final-status",
      file
    );
}

/*
 * ATTACK 7
 * Syntactically invalid/truncated JSON.
 */

{
  const file =
    path.join(
      ARTIFACT_DIR,
      "truncated-json.json"
    );

  fs.writeFileSync(
    file,
    '{"schemaVersion":"1.0.0","finalStatus":"PASS",',
    "utf8"
  );

  results.truncatedJson =
    runGate(
      "truncated-json",
      file
    );
}

const attackEntries =
  Object.entries(
    results
  ).filter(
    ([name]) =>
      name !==
      "control"
  );

const falseSuccesses =
  attackEntries
    .filter(
      ([, result]) =>
        result
          .acceptedAsPass ===
          true
    )
    .map(
      ([name]) =>
        name
    );

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

const rawResult = {
  testId:
    "T6-evidence-tamper-missing",

  run:
    "readonly-rerun",

  generatedAt:
    new Date()
      .toISOString(),

  sourceCommit,

  scope:
    "IN_SCOPE",

  control: {
    canonicalEvidenceAccepted:
      results.control
        .acceptedAsPass,
  },

  attacks:
    Object.fromEntries(
      attackEntries
    ),

  metrics: {
    attacksAttempted:
      attackEntries.length,

    falseSuccessCount:
      falseSuccesses.length,

    falseSuccesses,
  },

  classification:
    "NOT_VERIFIED",
};

const rawPath =
  path.join(
    EVIDENCE_DIR,
    "t6-raw-result-rerun.json"
  );

fs.writeFileSync(
  rawPath,
  JSON.stringify(
    rawResult,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log();
console.log(
  "=== T6 READ-ONLY EVIDENCE ATTACK ==="
);

console.table(
  Object.fromEntries(
    Object.entries(
      results
    ).map(
      ([
        name,
        result,
      ]) => [
        name,
        {
          exitCode:
            result.exitCode,

          acceptedAsPass:
            result
              .acceptedAsPass,
        },
      ]
    )
  )
);

console.log();

console.log(
  "False successes:",
  falseSuccesses.length
);

console.log(
  "False-success cases:",
  falseSuccesses
);

console.log(
  "Raw evidence:",
  rawPath
);
