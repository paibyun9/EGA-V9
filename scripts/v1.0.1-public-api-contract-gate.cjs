"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const repoRoot = process.cwd();

const contractRelativePath =
  "contracts/public-api-v1.0.1.json";

const rootPackageRelativePath =
  "package.json";

const sdkPackageRelativePath =
  "packages/sdk-ts/package.json";

const evidenceRelativePath =
  "publication/evidence/v1.0.1/public-api-contract-gate.json";

const auditRelativePath =
  "audit/v1.0.1/public-api-contract-gate.txt";

const contractPath = path.join(
  repoRoot,
  contractRelativePath,
);

const rootPackagePath = path.join(
  repoRoot,
  rootPackageRelativePath,
);

const sdkPackagePath = path.join(
  repoRoot,
  sdkPackageRelativePath,
);

const evidencePath = path.join(
  repoRoot,
  evidenceRelativePath,
);

const auditPath = path.join(
  repoRoot,
  auditRelativePath,
);

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(file, "utf8"),
  );
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);

  return left.filter(
    (value) => !rightSet.has(value),
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  return {
    command: [command, ...args].join(" "),
    exitCode:
      typeof result.status === "number"
        ? result.status
        : 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function addCheck(checks, {
  id,
  pass,
  expected,
  observed,
  message,
}) {
  checks.push({
    id,
    status: pass ? "PASS" : "FAIL",
    expected,
    observed,
    message,
  });
}

fs.mkdirSync(
  path.dirname(evidencePath),
  { recursive: true },
);

fs.mkdirSync(
  path.dirname(auditPath),
  { recursive: true },
);

const checks = [];

if (!fs.existsSync(contractPath)) {
  console.error(
    `Missing contract: ${contractRelativePath}`,
  );

  process.exit(1);
}

const contract = readJson(contractPath);
const rootPackage = readJson(rootPackagePath);
const sdkPackage = readJson(sdkPackagePath);

const requiredExports = sortedUnique(
  contract.requiredExports || [],
);

const forbiddenExports = sortedUnique(
  contract.forbiddenExports || [],
);

const buildResult = run("npm", [
  "run",
  "build",
]);

addCheck(checks, {
  id: "build-pass",
  pass: buildResult.exitCode === 0,
  expected: 0,
  observed: buildResult.exitCode,
  message:
    buildResult.exitCode === 0
      ? "SDK build completed successfully."
      : "SDK build failed.",
});

const entryPointRelative =
  contract.entryPoint;

const entryPointPath = path.join(
  repoRoot,
  entryPointRelative,
);

addCheck(checks, {
  id: "entry-point-exists",
  pass: fs.existsSync(entryPointPath),
  expected: true,
  observed: fs.existsSync(entryPointPath),
  message: entryPointRelative,
});

let runtimeModule = null;
let runtimeLoadError = null;
let runtimeExports = [];

if (
  buildResult.exitCode === 0 &&
  fs.existsSync(entryPointPath)
) {
  try {
    const resolved =
      require.resolve(entryPointPath);

    delete require.cache[resolved];

    runtimeModule = require(entryPointPath);

    runtimeExports = sortedUnique(
      Object.keys(runtimeModule),
    );
  } catch (error) {
    runtimeLoadError =
      error instanceof Error
        ? error.message
        : String(error);
  }
}

addCheck(checks, {
  id: "commonjs-entry-load",
  pass:
    runtimeModule !== null &&
    runtimeLoadError === null,
  expected: "CommonJS load succeeds",
  observed:
    runtimeLoadError ||
    "CommonJS load succeeded",
  message:
    runtimeLoadError ||
    entryPointRelative,
});

const missingExports = difference(
  requiredExports,
  runtimeExports,
);

const unexpectedExports = difference(
  runtimeExports,
  requiredExports,
);

const presentForbiddenExports =
  forbiddenExports.filter(
    (name) => runtimeExports.includes(name),
  );

addCheck(checks, {
  id: "required-exports-complete",
  pass: missingExports.length === 0,
  expected: requiredExports,
  observed: runtimeExports,
  message:
    missingExports.length === 0
      ? "All required exports are present."
      : `Missing exports: ${missingExports.join(", ")}`,
});

addCheck(checks, {
  id: "unexpected-exports-absent",
  pass: unexpectedExports.length === 0,
  expected: [],
  observed: unexpectedExports,
  message:
    unexpectedExports.length === 0
      ? "No unexpected public exports found."
      : `Unexpected exports: ${unexpectedExports.join(", ")}`,
});

addCheck(checks, {
  id: "forbidden-exports-absent",
  pass:
    presentForbiddenExports.length === 0,
  expected: [],
  observed: presentForbiddenExports,
  message:
    presentForbiddenExports.length === 0
      ? "No forbidden exports found."
      : `Forbidden exports found: ${presentForbiddenExports.join(", ")}`,
});

for (
  const exportName of
  contract.policy
    ?.requireCallableFunctionExports || []
) {
  const observedType =
    runtimeModule === null
      ? "unavailable"
      : typeof runtimeModule[exportName];

  addCheck(checks, {
    id: `callable-export-${exportName}`,
    pass: observedType === "function",
    expected: "function",
    observed: observedType,
    message:
      `${exportName} must remain callable.`,
  });
}

for (
  const exportName of
  contract.policy?.requireObjectExports || []
) {
  const observedType =
    runtimeModule === null
      ? "unavailable"
      : typeof runtimeModule[exportName];

  addCheck(checks, {
    id: `object-export-${exportName}`,
    pass:
      observedType === "object" &&
      runtimeModule[exportName] !== null,
    expected: "object",
    observed: observedType,
    message:
      `${exportName} must remain an object export.`,
  });
}


if (contract.policy?.requireEgaExport) {
  const egaType =
    runtimeModule === null
      ? "unavailable"
      : typeof runtimeModule.EGA;

  const egaPass =
    runtimeModule !== null &&
    Object.prototype.hasOwnProperty.call(
      runtimeModule,
      "EGA",
    ) &&
    (
      egaType === "function" ||
      egaType === "object"
    );

  addCheck(checks, {
    id: "ega-export-present",
    pass: egaPass,
    expected:
      "EGA export exists as function or object",
    observed: egaType,
    message:
      "The principal EGA export must remain available.",
  });
}

const rootMain =
  typeof rootPackage.main === "string"
    ? rootPackage.main
    : null;

const sdkMain =
  typeof sdkPackage.main === "string"
    ? sdkPackage.main
    : null;

const sdkTypes =
  typeof sdkPackage.types === "string"
    ? sdkPackage.types
    : null;

addCheck(checks, {
  id: "root-package-name",
  pass:
    rootPackage.name ===
    contract.packageName,
  expected: contract.packageName,
  observed: rootPackage.name,
  message:
    "Root package name must match the contract.",
});

addCheck(checks, {
  id: "sdk-package-name",
  pass:
    sdkPackage.name ===
    contract.packageName,
  expected: contract.packageName,
  observed: sdkPackage.name,
  message:
    "SDK package name must match the contract.",
});

const requireRootMain =
  contract.policy?.requireRootMain === true;

addCheck(checks, {
  id: "root-main-policy",
  pass:
    !requireRootMain ||
    (
      typeof rootMain === "string" &&
      rootMain.length > 0
    ),
  expected:
    requireRootMain
      ? "non-empty string"
      : "optional",
  observed: rootMain,
  message:
    requireRootMain
      ? "Root package main entry is required."
      : "Root package main entry is optional for the workspace root.",
});

addCheck(checks, {
  id: "sdk-main-defined",
  pass:
    typeof sdkMain === "string" &&
    sdkMain.length > 0,
  expected: "non-empty string",
  observed: sdkMain,
  message:
    "SDK package main entry must be defined.",
});

addCheck(checks, {
  id: "sdk-types-defined",
  pass:
    typeof sdkTypes === "string" &&
    sdkTypes.length > 0,
  expected: "non-empty string",
  observed: sdkTypes,
  message:
    "SDK TypeScript declaration entry must be defined.",
});

const resolvedSdkMainPath =
  sdkMain === null
    ? null
    : path.join(
        path.dirname(sdkPackagePath),
        sdkMain,
      );

const resolvedSdkTypesPath =
  sdkTypes === null
    ? null
    : path.join(
        path.dirname(sdkPackagePath),
        sdkTypes,
      );

addCheck(checks, {
  id: "sdk-main-file-exists",
  pass:
    resolvedSdkMainPath !== null &&
    fs.existsSync(resolvedSdkMainPath),
  expected: true,
  observed:
    resolvedSdkMainPath === null
      ? false
      : fs.existsSync(resolvedSdkMainPath),
  message:
    resolvedSdkMainPath === null
      ? "SDK main path is unavailable."
      : path.relative(
          repoRoot,
          resolvedSdkMainPath,
        ),
});

addCheck(checks, {
  id: "sdk-types-file-exists",
  pass:
    resolvedSdkTypesPath !== null &&
    fs.existsSync(resolvedSdkTypesPath),
  expected: true,
  observed:
    resolvedSdkTypesPath === null
      ? false
      : fs.existsSync(resolvedSdkTypesPath),
  message:
    resolvedSdkTypesPath === null
      ? "SDK types path is unavailable."
      : path.relative(
          repoRoot,
          resolvedSdkTypesPath,
        ),
});

let declarationText = "";

if (
  resolvedSdkTypesPath &&
  fs.existsSync(resolvedSdkTypesPath)
) {
  declarationText = fs.readFileSync(
    resolvedSdkTypesPath,
    "utf8",
  );
}

const declarationExportMatches = {};

for (const exportName of requiredExports) {
  const escapedName = exportName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const patterns = [
    new RegExp(
      `\\bexport\\s+(?:declare\\s+)?(?:class|function|const|let|var|interface|type|enum|namespace)\\s+${escapedName}\\b`,
    ),
    new RegExp(
      `\\bexport\\s*\\{[^}]*\\b${escapedName}\\b[^}]*\\}`,
    ),
  ];

  const present = patterns.some(
    (pattern) => pattern.test(declarationText),
  );

  declarationExportMatches[exportName] =
    present;

  addCheck(checks, {
    id: `typescript-declaration-${exportName}`,
    pass: present,
    expected: true,
    observed: present,
    message:
      `${exportName} must appear in the public declaration file.`,
  });
}

const gitBranch = run("git", [
  "branch",
  "--show-current",
]);

const latestCommit = run("git", [
  "log",
  "-1",
  "--oneline",
]);

const failedChecks = checks.filter(
  (check) => check.status === "FAIL",
);

const passedChecks = checks.filter(
  (check) => check.status === "PASS",
);

const finalStatus =
  failedChecks.length === 0
    ? "PASS"
    : "BLOCKED";

const evidence = {
  schemaVersion: "1.0.0",
  gateId: "v1.0.1-public-api-contract-lock",
  packageName: contract.packageName,
  releaseTarget:
    `${contract.packageName}@${contract.releaseTarget}`,
  generatedAt: new Date().toISOString(),

  repository: {
    branch: gitBranch.stdout,
    latestCommit: latestCommit.stdout,
  },

  contract: {
    file: contractRelativePath,
    sha256: sha256File(contractPath),
    entryPoint: entryPointRelative,
    requiredExports,
    forbiddenExports,
  },

  packageMetadata: {
    root: {
      name: rootPackage.name,
      version: rootPackage.version,
      main: rootPackage.main || null,
      types: rootPackage.types || null,
      exports: rootPackage.exports || null,
    },
    sdk: {
      name: sdkPackage.name,
      version: sdkPackage.version,
      main: sdkPackage.main || null,
      types: sdkPackage.types || null,
      exports: sdkPackage.exports || null,
    },
  },

  runtime: {
    loadError: runtimeLoadError,
    exports: runtimeExports,
    missingExports,
    unexpectedExports,
    forbiddenExportsFound:
      presentForbiddenExports,
    exportTypes:
      runtimeModule === null
        ? {}
        : Object.fromEntries(
            runtimeExports.map(
              (name) => [
                name,
                typeof runtimeModule[name],
              ],
            ),
          ),
  },

  typescriptDeclarations: {
    file:
      resolvedSdkTypesPath === null
        ? null
        : path.relative(
            repoRoot,
            resolvedSdkTypesPath,
          ),
    requiredExportMatches:
      declarationExportMatches,
  },

  totals: {
    totalChecks: checks.length,
    passedChecks: passedChecks.length,
    failedChecks: failedChecks.length,
  },

  checks,
  finalStatus,
  releaseAllowed:
    finalStatus === "PASS",
};

fs.writeFileSync(
  evidencePath,
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);

const lines = [];

lines.push("EGA V9@1.0.1");
lines.push("Public API Contract Lock");
lines.push("========================");
lines.push("");

lines.push(
  `Contract: ${contractRelativePath}`,
);

lines.push(
  `Entry:    ${entryPointRelative}`,
);

lines.push(
  `Required: ${requiredExports.join(", ")}`,
);

lines.push("");

for (const check of checks) {
  lines.push(
    `${check.status.padEnd(5)} ${check.id}`,
  );

  if (check.status === "FAIL") {
    lines.push(
      `      Expected: ${JSON.stringify(check.expected)}`,
    );

    lines.push(
      `      Observed: ${JSON.stringify(check.observed)}`,
    );
  }

  lines.push(
    `      ${check.message}`,
  );
}

lines.push("");
lines.push("------------------------");

lines.push(
  `Checks:  ${checks.length}`,
);

lines.push(
  `Passed:  ${passedChecks.length}`,
);

lines.push(
  `Failed:  ${failedChecks.length}`,
);

lines.push(
  `Final:   ${finalStatus}`,
);

lines.push(
  `Release: ${
    evidence.releaseAllowed
      ? "ALLOWED"
      : "BLOCKED"
  }`,
);

lines.push("");

lines.push(
  `Evidence: ${evidenceRelativePath}`,
);

const report =
  `${lines.join("\n")}\n`;

fs.writeFileSync(
  auditPath,
  report,
  "utf8",
);

process.stdout.write(report);

if (finalStatus !== "PASS") {
  process.exitCode = 1;
}
