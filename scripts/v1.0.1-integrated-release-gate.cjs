"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const REPO_ROOT =
  path.resolve(__dirname, "..");

const RELEASE_TARGET =
  "1.0.1";

const REQUIRE_CLEAN =
  process.argv.includes("--require-clean");

const REQUIRE_TARGET_VERSION =
  process.argv.includes(
    "--require-target-version"
  );

const AUDIT_DIR =
  path.join(
    REPO_ROOT,
    "audit",
    "v1.0.1",
    "step-11-integrated-release-gate"
  );

const PUBLIC_EVIDENCE_DIR =
  path.join(
    REPO_ROOT,
    "publication",
    "evidence",
    "v1.0.1"
  );

const SDK_DIR =
  path.join(
    REPO_ROOT,
    "packages",
    "sdk-ts"
  );

const results = [];

fs.mkdirSync(
  AUDIT_DIR,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  PUBLIC_EVIDENCE_DIR,
  {
    recursive: true,
  }
);

function printableCommand(
  command,
  args
) {
  return [
    command,
    ...args,
  ].join(" ");
}

function runCommand({
  id,
  name,
  command,
  args = [],
  cwd = REPO_ROOT,
  env = {},
  allowFailure = false,
}) {
  console.log(
    `\n[${id}] ${name}`
  );

  console.log(
    `$ ${printableCommand(
      command,
      args
    )}`
  );

  const result =
    spawnSync(
      command,
      args,
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          ...env,
        },
      }
    );

  if (result.stdout) {
    process.stdout.write(
      result.stdout
    );
  }

  if (result.stderr) {
    process.stderr.write(
      result.stderr
    );
  }

  const exitCode =
    typeof result.status === "number"
      ? result.status
      : 1;

  const pass =
    exitCode === 0;

  results.push({
    id,
    name,
    pass:
      pass || allowFailure,
    actualPass:
      pass,
    exitCode,
    command:
      printableCommand(
        command,
        args
      ),
  });

  console.log(
    `${pass ? "✅" : "❌"} ` +
    `${id}: ${name} ` +
    `(exit=${exitCode})`
  );

  return {
    ...result,
    exitCode,
    pass,
  };
}

function record(
  id,
  name,
  pass,
  details = undefined
) {
  results.push({
    id,
    name,
    pass:
      Boolean(pass),
    actualPass:
      Boolean(pass),
    exitCode:
      pass ? 0 : 1,
    details,
  });

  console.log(
    `${pass ? "✅" : "❌"} ` +
    `${id}: ${name}`
  );

  if (
    !pass &&
    details !== undefined
  ) {
    console.dir(
      details,
      {
        depth: null,
      }
    );
  }
}

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function writeJson(
  file,
  value
) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n"
  );
}


function sanitizePublicEvidenceValue(value) {
  if (Array.isArray(value)) {
    return value.map(
      sanitizePublicEvidenceValue
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, nestedValue]) => [
          key,
          sanitizePublicEvidenceValue(
            nestedValue
          ),
        ]
      )
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(
      /file:\/\/\/Users\/[^\s"'<>]+/g,
      "<local-user-path>"
    )
    .replace(
      /file:\/Users\/[^\s"'<>]+/g,
      "<local-user-path>"
    )
    .replace(
      /\/Users\/[^\s"'<>]+/g,
      "<local-user-path>"
    )
    .replace(
      /\/home\/[^\s"'<>]+/g,
      "<local-home-path>"
    )
    .replace(
      /\/private\/var\/folders\/[^\s"'<>]+/g,
      "<local-temp-path>"
    )
    .replace(
      /\/var\/folders\/[^\s"'<>]+/g,
      "<local-temp-path>"
    )
    .replace(
      /\/private\/tmp\/[^\s"'<>]+/g,
      "<local-temp-path>"
    )
    .replace(
      /\/tmp\/[^\s"'<>]+/g,
      "<local-temp-path>"
    )
    .replace(
      /[A-Za-z]:\\\\Users\\\\[^\s"'<>]+/g,
      "<windows-user-path>"
    );
}

function sanitizePublicJsonFile(file) {
  const original =
    fs.readFileSync(
      file,
      "utf8"
    );

  const parsed =
    JSON.parse(original);

  const sanitizedValue =
    sanitizePublicEvidenceValue(
      parsed
    );

  const sanitized =
    JSON.stringify(
      sanitizedValue,
      null,
      2
    ) + "\n";

  const changed =
    sanitized !== original;

  if (changed) {
    fs.writeFileSync(
      file,
      sanitized
    );
  }

  return changed;
}

function listFiles(directory) {
  const files = [];

  function walk(current) {
    for (
      const entry of
      fs.readdirSync(
        current,
        {
          withFileTypes: true,
        }
      )
    ) {
      const fullPath =
        path.join(
          current,
          entry.name
        );

      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walk(directory);

  return files;
}

function hasLocalPathLeak(file) {
  const text =
    fs.readFileSync(
      file,
      "utf8"
    );

  const patterns = [
    /\/Users\//,
    /\/home\//,
    /[A-Za-z]:\\Users\\/,
    /\/tmp\/ega-v9/,
    /\/private\/tmp\/ega-v9/,
    /\/var\/folders\//,
    /\/private\/var\/folders\//,
  ];

  return patterns.some(
    pattern =>
      pattern.test(text)
  );
}

function copyFile(
  source,
  destination
) {
  fs.mkdirSync(
    path.dirname(destination),
    {
      recursive: true,
    }
  );

  fs.copyFileSync(
    source,
    destination
  );
}

function main() {
  console.log(
    "EGA V9 v1.0.1 Integrated Release Gate"
  );

  console.log({
    releaseTarget:
      RELEASE_TARGET,
    requireClean:
      REQUIRE_CLEAN,
    requireTargetVersion:
      REQUIRE_TARGET_VERSION,
    repository:
      REPO_ROOT,
  });

  /*
   * A. Repository prerequisites
   */

  const requiredFiles = [
    "contracts/public-api-v1.0.1.json",
    "contracts/input-validation-v1.0.1.json",
    "scripts/v1.0.1-phase-a-api-audit.cjs",
    "scripts/v1.0.1-public-api-contract-gate.cjs",
    "scripts/v1.0.1-seven-test-baseline.cjs",
    "scripts/v1.0.1-fail-closed-runtime-gate.cjs",
    "scripts/v1.0.1-export-compatibility-gate.cjs",
    "scripts/v1.0.1-examples-gate.cjs",
    "scripts/v1.0.1-express-examples-import-gate.cjs",
    "scripts/v1.0.1-readme-sdk-alignment-gate.cjs",
    "scripts/v1.0.1-fresh-consumer-12-test-gate.cjs",
    "examples/commonjs/basic.cjs",
    "examples/esm/basic.mjs",
    "examples/typescript/basic.mts",
    "examples/typescript/tsconfig.json",
  ];

  const missingFiles =
    requiredFiles.filter(
      relativePath =>
        !fs.existsSync(
          path.join(
            REPO_ROOT,
            relativePath
          )
        )
    );

  record(
    "A01",
    "Required release files exist",
    missingFiles.length === 0,
    {
      missingFiles,
    }
  );

  /*
   * B. Existing Step 1–8 gates
   */

  const existingGates = [
    {
      id: "B01",
      name:
        "Phase A API audit",
      script:
        "scripts/v1.0.1-phase-a-api-audit.cjs",
    },
    {
      id: "B02",
      name:
        "Public API contract gate",
      script:
        "scripts/v1.0.1-public-api-contract-gate.cjs",
    },
    {
      id: "B03",
      name:
        "Seven-test verification baseline",
      script:
        "scripts/v1.0.1-seven-test-baseline.cjs",
    },
    {
      id: "B04",
      name:
        "Fail-closed runtime gate",
      script:
        "scripts/v1.0.1-fail-closed-runtime-gate.cjs",
    },
    {
      id: "B05",
      name:
        "Export compatibility gate",
      script:
        "scripts/v1.0.1-export-compatibility-gate.cjs",
    },
    {
      id: "B06",
      name:
        "Executable examples gate",
      script:
        "scripts/v1.0.1-examples-gate.cjs",
    },
    {
      id: "B07",
      name:
        "Express examples import gate",
      script:
        "scripts/v1.0.1-express-examples-import-gate.cjs",
    },
    {
      id: "B08",
      name:
        "README and SDK alignment gate",
      script:
        "scripts/v1.0.1-readme-sdk-alignment-gate.cjs",
    },
  ];

  for (const gate of existingGates) {
    runCommand({
      id:
        gate.id,
      name:
        gate.name,
      command:
        process.execPath,
      args: [
        gate.script,
      ],
    });
  }

  /*
   * C. Build and package metadata
   */

  runCommand({
    id: "C01",
    name:
      "SDK build",
    command:
      "npm",
    args: [
      "run",
      "build",
    ],
  });

  runCommand({
    id: "C02",
    name:
      "Repository test suite",
    command:
      "npm",
    args: [
      "test",
    ],
  });

  const rootPackage =
    readJson(
      path.join(
        REPO_ROOT,
        "package.json"
      )
    );

  const sdkPackage =
    readJson(
      path.join(
        SDK_DIR,
        "package.json"
      )
    );

  const versionsMatch =
    rootPackage.version ===
    sdkPackage.version;

  record(
    "C03",
    "Root and SDK versions match",
    versionsMatch,
    {
      rootVersion:
        rootPackage.version,
      sdkVersion:
        sdkPackage.version,
    }
  );

  const targetVersionPass =
    !REQUIRE_TARGET_VERSION ||
    (
      rootPackage.version ===
        RELEASE_TARGET &&
      sdkPackage.version ===
        RELEASE_TARGET
    );

  record(
    "C04",
    REQUIRE_TARGET_VERSION
      ? "Package version equals release target"
      : "Release-target version enforcement deferred",
    targetVersionPass,
    {
      releaseTarget:
        RELEASE_TARGET,
      rootVersion:
        rootPackage.version,
      sdkVersion:
        sdkPackage.version,
      enforcement:
        REQUIRE_TARGET_VERSION,
    }
  );

  /*
   * D. Create a new npm tarball
   */

  const temporaryRoot =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "ega-v9-integrated-release-"
      )
    );

  const packDirectory =
    path.join(
      temporaryRoot,
      "pack"
    );

  const freshDirectory =
    path.join(
      temporaryRoot,
      "consumer"
    );

  fs.mkdirSync(
    packDirectory,
    {
      recursive: true,
    }
  );

  fs.mkdirSync(
    freshDirectory,
    {
      recursive: true,
    }
  );

  const packResult =
    runCommand({
      id: "D01",
      name:
        "Create SDK npm tarball",
      command:
        "npm",
      args: [
        "pack",
        "./packages/sdk-ts",
        "--pack-destination",
        packDirectory,
        "--json",
      ],
    });

  let packedMetadata;
  let tarballPath;

  try {
    const parsed =
      JSON.parse(
        packResult.stdout || "[]"
      );

    packedMetadata =
      parsed[0];

    if (packedMetadata?.filename) {
      tarballPath =
        path.join(
          packDirectory,
          packedMetadata.filename
        );
    }
  } catch (error) {
    packedMetadata = {
      parseError:
        error.message,
    };
  }

  record(
    "D02",
    "Tarball exists",
    Boolean(
      tarballPath &&
      fs.existsSync(tarballPath)
    ),
    {
      tarballFilename:
        packedMetadata?.filename,
      packedVersion:
        packedMetadata?.version,
    }
  );

  record(
    "D03",
    "Tarball version matches SDK version",
    Boolean(
      packedMetadata &&
      packedMetadata.version ===
        sdkPackage.version
    ),
    {
      sdkVersion:
        sdkPackage.version,
      packedVersion:
        packedMetadata?.version,
    }
  );

  const packedFiles =
    Array.isArray(
      packedMetadata?.files
    )
      ? packedMetadata.files.map(
          entry => entry.path
        )
      : [];

  const requiredPackedFiles = [
    "LICENSE",
    "README.md",
    "dist/index.js",
    "dist/index.mjs",
    "dist/index.d.ts",
    "package.json",
  ];

  const missingPackedFiles =
    requiredPackedFiles.filter(
      required =>
        !packedFiles.includes(
          required
        )
    );

  const forbiddenPackedFiles =
    packedFiles.filter(
      file =>
        /^(src|test|tests|scripts|audit|publication)\//.test(
          file
        ) ||
        /\.before-/.test(file) ||
        /\.DS_Store$/.test(file)
    );

  record(
    "D04",
    "Tarball content is complete and clean",
    missingPackedFiles.length === 0 &&
      forbiddenPackedFiles.length === 0,
    {
      packedFiles,
      missingPackedFiles,
      forbiddenPackedFiles,
    }
  );

  /*
   * E. Prepare completely fresh consumer
   */

  runCommand({
    id: "E01",
    name:
      "Initialize fresh consumer",
    command:
      "npm",
    args: [
      "init",
      "-y",
    ],
    cwd:
      freshDirectory,
  });

  runCommand({
    id: "E02",
    name:
      "Install packed SDK into fresh consumer",
    command:
      "npm",
    args: [
      "install",
      tarballPath,
    ],
    cwd:
      freshDirectory,
  });

  runCommand({
    id: "E03",
    name:
      "Install TypeScript consumer compiler",
    command:
      "npm",
    args: [
      "install",
      "--save-dev",
      "typescript@^5",
    ],
    cwd:
      freshDirectory,
  });

  const fixtureCopies = [
    [
      "contracts/public-api-v1.0.1.json",
      "contracts/public-api-v1.0.1.json",
    ],
    [
      "examples/commonjs/basic.cjs",
      "examples/commonjs/basic.cjs",
    ],
    [
      "examples/esm/basic.mjs",
      "examples/esm/basic.mjs",
    ],
    [
      "examples/typescript/basic.mts",
      "examples/typescript/basic.mts",
    ],
    [
      "examples/typescript/tsconfig.json",
      "examples/typescript/tsconfig.json",
    ],
    [
      "scripts/v1.0.1-fresh-consumer-12-test-gate.cjs",
      "fresh-consumer-12-test-gate.cjs",
    ],
  ];

  for (
    const [
      sourceRelative,
      destinationRelative,
    ] of fixtureCopies
  ) {
    copyFile(
      path.join(
        REPO_ROOT,
        sourceRelative
      ),
      path.join(
        freshDirectory,
        destinationRelative
      )
    );
  }

  record(
    "E04",
    "Fresh-consumer fixtures copied",
    fixtureCopies.every(
      ([, destinationRelative]) =>
        fs.existsSync(
          path.join(
            freshDirectory,
            destinationRelative
          )
        )
    )
  );

  /*
   * F. Run Fresh Consumer 12-Test Gate
   */

  const freshGateResult =
    runCommand({
      id: "F01",
      name:
        "Fresh Consumer 12-Test Gate",
      command:
        process.execPath,
      args: [
        "fresh-consumer-12-test-gate.cjs",
      ],
      cwd:
        freshDirectory,
    });

  const freshEvidencePath =
    path.join(
      freshDirectory,
      "fresh-consumer-12-test-evidence.json"
    );

  const freshConsolePath =
    path.join(
      AUDIT_DIR,
      "fresh-consumer-12-test-console.txt"
    );

  fs.writeFileSync(
    freshConsolePath,
    [
      freshGateResult.stdout || "",
      freshGateResult.stderr || "",
    ].join("")
  );

  let freshEvidence;

  if (
    fs.existsSync(
      freshEvidencePath
    )
  ) {
    freshEvidence =
      readJson(
        freshEvidencePath
      );
  }

  const freshSummary =
    freshEvidence?.summary;

  const twelveTestsPass =
    freshSummary?.finalStatus ===
      "PASS" &&
    freshSummary?.totalTests ===
      12 &&
    freshSummary?.passedTests ===
      12 &&
    freshSummary?.failedTests ===
      0 &&
    Array.isArray(
      freshEvidence?.tests
    ) &&
    freshEvidence.tests.length ===
      12 &&
    freshEvidence.tests.every(
      test =>
        test.pass === true
    );

  record(
    "F02",
    "Fresh Consumer evidence reports 12/12 PASS",
    twelveTestsPass,
    {
      summary:
        freshSummary,
    }
  );

  const freshPathLeak =
    fs.existsSync(
      freshEvidencePath
    )
      ? hasLocalPathLeak(
          freshEvidencePath
        )
      : true;

  record(
    "F03",
    "Fresh Consumer evidence has no local path leak",
    freshPathLeak === false,
    {
      pathLeakDetected:
        freshPathLeak,
    }
  );

  if (
    twelveTestsPass &&
    !freshPathLeak
  ) {
    copyFile(
      freshEvidencePath,
      path.join(
        PUBLIC_EVIDENCE_DIR,
        "fresh-consumer-12-test.json"
      )
    );
  }

  /*
   * G. Public evidence validation
   */

  const evidenceFilesBeforeSanitization =
    fs.existsSync(
      PUBLIC_EVIDENCE_DIR
    )
      ? listFiles(
          PUBLIC_EVIDENCE_DIR
        ).filter(
          evidenceFile =>
            evidenceFile.endsWith(".json")
        )
      : [];

  const sanitizedEvidenceFiles =
    [];

  for (
    const evidenceFile of
    evidenceFilesBeforeSanitization
  ) {
    if (
      sanitizePublicJsonFile(
        evidenceFile
      )
    ) {
      sanitizedEvidenceFiles.push(
        path.relative(
          REPO_ROOT,
          evidenceFile
        )
      );
    }
  }

  record(
    "G00",
    "Public v1.0.1 evidence sanitized for publication",
    true,
    {
      checkedFiles:
        evidenceFilesBeforeSanitization.length,
      sanitizedFileCount:
        sanitizedEvidenceFiles.length,
      sanitizedEvidenceFiles,
    }
  );

  const publicEvidenceFiles =
    fs.existsSync(
      PUBLIC_EVIDENCE_DIR
    )
      ? listFiles(
          PUBLIC_EVIDENCE_DIR
        ).filter(
          file =>
            file.endsWith(".json")
        )
      : [];

  const leakingEvidenceFiles =
    publicEvidenceFiles
      .filter(
        file =>
          hasLocalPathLeak(file)
      )
      .map(
        file =>
          path.relative(
            REPO_ROOT,
            file
          )
      );

  record(
    "G01",
    "Public v1.0.1 evidence contains no local paths",
    leakingEvidenceFiles.length === 0,
    {
      checkedFiles:
        publicEvidenceFiles.length,
      leakingEvidenceFiles,
    }
  );

  /*
   * H. Git formatting and repository state
   */

  runCommand({
    id: "H01",
    name:
      "Git diff whitespace check",
    command:
      "git",
    args: [
      "diff",
      "--check",
    ],
  });

  const statusResult =
    spawnSync(
      "git",
      [
        "status",
        "--porcelain",
      ],
      {
        cwd:
          REPO_ROOT,
        encoding:
          "utf8",
      }
    );

  const statusLines =
    (statusResult.stdout || "")
      .split(/\r?\n/)
      .filter(Boolean);

  const cleanPass =
    !REQUIRE_CLEAN ||
    statusLines.length === 0;

  record(
    "H02",
    REQUIRE_CLEAN
      ? "Git working tree is clean"
      : "Git clean-tree enforcement deferred",
    cleanPass,
    {
      requireClean:
        REQUIRE_CLEAN,
      changedFileCount:
        statusLines.length,
      statusLines:
        REQUIRE_CLEAN
          ? statusLines
          : undefined,
    }
  );

  /*
   * Final summary
   */

  const failed =
    results.filter(
      result =>
        result.pass !== true
    );

  const summary = {
    schemaVersion:
      "1.0",
    releaseTarget:
      RELEASE_TARGET,
    packageVersion:
      sdkPackage.version,
    mode: {
      requireClean:
        REQUIRE_CLEAN,
      requireTargetVersion:
        REQUIRE_TARGET_VERSION,
    },
    finalStatus:
      failed.length === 0
        ? "PASS"
        : "BLOCKED",
    totalChecks:
      results.length,
    passedChecks:
      results.length -
      failed.length,
    failedChecks:
      failed.length,
    failedCheckIds:
      failed.map(
        result =>
          result.id
      ),
    freshConsumer: {
      totalTests:
        freshSummary?.totalTests,
      passedTests:
        freshSummary?.passedTests,
      failedTests:
        freshSummary?.failedTests,
    },
  };

  const evidence = {
    schemaVersion:
      "1.0",
    generatedAt:
      new Date().toISOString(),
    summary,
    checks:
      results,
  };

  const integratedEvidencePath =
    path.join(
      PUBLIC_EVIDENCE_DIR,
      "integrated-release-gate.json"
    );

  writeJson(
    integratedEvidencePath,
    evidence
  );

  const integratedEvidenceSanitized =
    sanitizePublicJsonFile(
      integratedEvidencePath
    );

  console.log(
    integratedEvidenceSanitized
      ? "INTEGRATED_EVIDENCE_SANITIZATION=APPLIED"
      : "INTEGRATED_EVIDENCE_SANITIZATION=NOT_REQUIRED"
  );

  const integratedPathLeak =
    hasLocalPathLeak(
      integratedEvidencePath
    );

  console.log("\nINTEGRATED SUMMARY");
  console.dir(
    summary,
    {
      depth: null,
    }
  );

  if (integratedPathLeak) {
    console.error(
      "INTEGRATED_EVIDENCE_PATH_LEAK=BLOCKED"
    );

    process.exit(1);
  }

  console.log(
    "INTEGRATED_EVIDENCE_PATH_LEAK=PASS"
  );

  if (failed.length > 0) {
    console.error(
      "V1_0_1_INTEGRATED_RELEASE_GATE=BLOCKED"
    );

    process.exit(1);
  }

  console.log(
    "V1_0_1_INTEGRATED_RELEASE_GATE=PASS"
  );
}

try {
  main();
} catch (error) {
  console.error(
    error?.stack ||
    error
  );

  process.exit(1);
}
