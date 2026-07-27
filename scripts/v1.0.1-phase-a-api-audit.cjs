"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = process.cwd();
const sdkRoot = path.join(repoRoot, "packages", "sdk-ts");
const outputDir = path.join(repoRoot, "publication", "evidence", "v1.0.1");
const outputFile = path.join(outputDir, "phase-a-api-audit.json");

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function readJson(absolutePath) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    return {
      __readError: error instanceof Error ? error.message : String(error),
    };
  }
}

function listFiles(absolutePath, maxDepth = 3, currentDepth = 0) {
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  if (currentDepth > maxDepth) {
    return [];
  }

  const entries = fs.readdirSync(absolutePath, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...listFiles(fullPath, maxDepth, currentDepth + 1),
      );
    } else {
      files.push(path.relative(repoRoot, fullPath));
    }
  }

  return files.sort();
}

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
  });

  return {
    command: [command, ...args].join(" "),
    cwd: path.relative(repoRoot, cwd) || ".",
    exitCode:
      typeof result.status === "number"
        ? result.status
        : 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function getExportKeysFromPath(modulePath) {
  try {
    const loadedModule = require(modulePath);

    if (
      loadedModule !== null &&
      (typeof loadedModule === "object" ||
        typeof loadedModule === "function")
    ) {
      return {
        loaded: true,
        type: typeof loadedModule,
        keys: Object.keys(loadedModule).sort(),
      };
    }

    return {
      loaded: true,
      type: typeof loadedModule,
      keys: [],
      value: loadedModule,
    };
  } catch (error) {
    return {
      loaded: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

fs.mkdirSync(outputDir, {
  recursive: true,
});

const rootPackagePath = path.join(repoRoot, "package.json");
const sdkPackagePath = path.join(sdkRoot, "package.json");

const rootPackage = readJson(rootPackagePath);
const sdkPackage = readJson(sdkPackagePath);

const candidateBuildDirectories = [
  path.join(sdkRoot, "dist"),
  path.join(sdkRoot, "lib"),
  path.join(sdkRoot, "build"),
];

const buildFiles = candidateBuildDirectories.flatMap(
  (directory) => listFiles(directory, 4),
);

const candidateEntryPoints = [];

if (sdkPackage.main) {
  candidateEntryPoints.push({
    name: "main",
    configuredPath: sdkPackage.main,
    absolutePath: path.resolve(sdkRoot, sdkPackage.main),
  });
}

if (sdkPackage.module) {
  candidateEntryPoints.push({
    name: "module",
    configuredPath: sdkPackage.module,
    absolutePath: path.resolve(sdkRoot, sdkPackage.module),
  });
}

if (sdkPackage.exports && typeof sdkPackage.exports === "string") {
  candidateEntryPoints.push({
    name: "exports",
    configuredPath: sdkPackage.exports,
    absolutePath: path.resolve(sdkRoot, sdkPackage.exports),
  });
}

if (
  sdkPackage.exports &&
  typeof sdkPackage.exports === "object" &&
  sdkPackage.exports["."]
) {
  const rootExport = sdkPackage.exports["."];

  if (typeof rootExport === "string") {
    candidateEntryPoints.push({
      name: "exports[.]",
      configuredPath: rootExport,
      absolutePath: path.resolve(sdkRoot, rootExport),
    });
  } else if (rootExport && typeof rootExport === "object") {
    for (const [condition, configuredPath] of Object.entries(rootExport)) {
      if (typeof configuredPath === "string") {
        candidateEntryPoints.push({
          name: `exports[.].${condition}`,
          configuredPath,
          absolutePath: path.resolve(sdkRoot, configuredPath),
        });
      }
    }
  }
}

const entryPointAudit = candidateEntryPoints.map((entryPoint) => ({
  ...entryPoint,
  exists: fs.existsSync(entryPoint.absolutePath),
  relativePath: path.relative(repoRoot, entryPoint.absolutePath),
  runtime:
    fs.existsSync(entryPoint.absolutePath) &&
    !entryPoint.absolutePath.endsWith(".d.ts")
      ? getExportKeysFromPath(entryPoint.absolutePath)
      : {
          loaded: false,
          skipped: true,
          reason: entryPoint.absolutePath.endsWith(".d.ts")
            ? "Type declaration file"
            : "Entry point does not exist",
        },
}));

const relevantScriptPattern =
  /(test|verify|verification|gate|replay|containment|consumer|release|build|example|pack)/i;

const relevantRootScripts = Object.fromEntries(
  Object.entries(rootPackage.scripts || {}).filter(([name, value]) =>
    relevantScriptPattern.test(`${name} ${value}`),
  ),
);

const relevantSdkScripts = Object.fromEntries(
  Object.entries(sdkPackage.scripts || {}).filter(([name, value]) =>
    relevantScriptPattern.test(`${name} ${value}`),
  ),
);

const evidence = {
  schemaVersion: "1.0.0",
  releaseTarget: "ega-v9@1.0.1",
  generatedAt: new Date().toISOString(),

  repository: {
    root: repoRoot,
    gitStatus: run("git", ["status", "--short"]),
    branch: run("git", ["branch", "--show-current"]),
    latestCommit: run("git", ["log", "-1", "--oneline"]),
  },

  environment: {
    node: run("node", ["--version"]),
    npm: run("npm", ["--version"]),
    platform: process.platform,
    architecture: process.arch,
  },

  files: {
    rootPackageExists: exists("package.json"),
    sdkPackageExists: exists("packages/sdk-ts/package.json"),
    rootReadmeExists: exists("README.md"),
    sdkReadmeExists: exists("packages/sdk-ts/README.md"),
    packageLockExists: exists("package-lock.json"),
    buildFiles,
  },

  rootPackage: {
    name: rootPackage.name,
    version: rootPackage.version,
    private: rootPackage.private,
    workspaces: rootPackage.workspaces,
    scripts: relevantRootScripts,
  },

  sdkPackage: {
    name: sdkPackage.name,
    version: sdkPackage.version,
    description: sdkPackage.description,
    main: sdkPackage.main,
    module: sdkPackage.module,
    types: sdkPackage.types,
    exports: sdkPackage.exports,
    files: sdkPackage.files,
    engines: sdkPackage.engines,
    repository: sdkPackage.repository,
    homepage: sdkPackage.homepage,
    bugs: sdkPackage.bugs,
    license: sdkPackage.license,
    scripts: relevantSdkScripts,
  },

  entryPoints: entryPointAudit,

  packageDryRun: run(
    "npm",
    ["pack", "--dry-run", "--json"],
    sdkRoot,
  ),

  releasePrinciples: {
    breakingPublicApiChangesAllowed: false,
    sevenRuntimeVerificationTestsRequired: true,
    freshConsumerValidationRequired: true,
    npmAuditVulnerabilityTarget: 0,
    absolutePathLeakTarget: 0,
  },
};

fs.writeFileSync(
  outputFile,
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);

console.log("");
console.log("EGA V9@1.0.1 Phase A API Audit");
console.log("================================");
console.log(`Root package: ${rootPackage.name || "UNKNOWN"}@${rootPackage.version || "UNKNOWN"}`);
console.log(`SDK package:  ${sdkPackage.name || "UNKNOWN"}@${sdkPackage.version || "UNKNOWN"}`);
console.log(`Branch:       ${evidence.repository.branch.stdout || "UNKNOWN"}`);
console.log(`Build files:  ${buildFiles.length}`);
console.log(`Entry points: ${entryPointAudit.length}`);
console.log("");

for (const entryPoint of entryPointAudit) {
  console.log(
    `- ${entryPoint.name}: ${entryPoint.relativePath} ` +
      `[${entryPoint.exists ? "FOUND" : "MISSING"}]`,
  );

  if (entryPoint.runtime?.loaded) {
    console.log(
      `  exports: ${entryPoint.runtime.keys.join(", ") || "(none)"}`,
    );
  } else if (entryPoint.runtime?.error) {
    console.log(`  load error: ${entryPoint.runtime.error}`);
  }
}

console.log("");
console.log(`Evidence written to:`);
console.log(path.relative(repoRoot, outputFile));
console.log("");

if (evidence.packageDryRun.exitCode !== 0) {
  console.error("npm pack --dry-run: FAIL");
  console.error(evidence.packageDryRun.stderr);
  process.exitCode = 1;
} else {
  console.log("npm pack --dry-run: PASS");
}
