"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  execFileSync,
  spawnSync,
} = require("node:child_process");
const {
  pathToFileURL,
} = require("node:url");

const ROOT = process.cwd();

const PACKAGE_DIR =
  path.join(
    ROOT,
    "node_modules",
    "ega-v9"
  );

const EVIDENCE_PATH =
  path.join(
    ROOT,
    "fresh-consumer-12-test-evidence.json"
  );

const results = [];

function record(
  number,
  name,
  pass,
  details = undefined
) {
  const result = {
    number,
    name,
    pass: Boolean(pass),
    details,
  };

  results.push(result);

  console.log(
    `${pass ? "✅" : "❌"} ` +
    `Test ${number}: ${name}`
  );

  if (!pass && details !== undefined) {
    console.dir(details, {
      depth: null,
    });
  }
}

function runNode(file) {
  return spawnSync(
    process.execPath,
    [file],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    }
  );
}

function extractExpectedExports(contract) {
  const candidates = [
    contract.exports,
    contract.publicExports,
    contract.publicApi,
    contract.publicAPI,
    contract.namedExports,
    contract.frozenExports,
    contract.api?.exports,
    contract.contract?.exports,
  ];

  for (const candidate of candidates) {
    if (
      Array.isArray(candidate) &&
      candidate.every(
        value =>
          typeof value === "string"
      )
    ) {
      return candidate;
    }
  }

  const arrays = [];

  function visit(value) {
    if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        value.every(
          entry =>
            typeof entry === "string"
        )
      ) {
        arrays.push(value);
      }

      for (const entry of value) {
        visit(entry);
      }

      return;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      for (
        const nested of
        Object.values(value)
      ) {
        visit(nested);
      }
    }
  }

  visit(contract);

  const likely =
    arrays.find(
      values =>
        values.length >= 2 &&
        values.length <= 30
    );

  return likely || [];
}

function sortedUnique(values) {
  return [
    ...new Set(values),
  ].sort();
}

function sameStringSet(a, b) {
  return (
    JSON.stringify(
      sortedUnique(a)
    ) ===
    JSON.stringify(
      sortedUnique(b)
    )
  );
}

async function main() {
  const installedPackagePath =
    path.join(
      PACKAGE_DIR,
      "package.json"
    );

  const installed =
    JSON.parse(
      fs.readFileSync(
        installedPackagePath,
        "utf8"
      )
    );

  const rootPackage =
    JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          "package.json"
        ),
        "utf8"
      )
    );

  /*
   * Test 1
   * Fresh installation exists and npm resolved it.
   */
  let npmList;

  try {
    npmList =
      JSON.parse(
        execFileSync(
          "npm",
          [
            "ls",
            "ega-v9",
            "--depth=0",
            "--json",
          ],
          {
            cwd: ROOT,
            encoding: "utf8",
          }
        )
      );
  } catch (error) {
    npmList = {
      error:
        error.message,
    };
  }

  const installedDependency =
    npmList.dependencies?.["ega-v9"];

  record(
    1,
    "Fresh npm installation succeeds",
    Boolean(
      installedDependency &&
      installedDependency.version
    ),
    {
      installedDependency: installedDependency
        ? {
            version:
              installedDependency.version,
          }
        : null,
    }
  );

  /*
   * Test 2
   * Installed identity and requested dependency match.
   */
  const requestedDependency =
    rootPackage.dependencies?.["ega-v9"];

  record(
    2,
    "Installed package identity and version are valid",
    installed.name === "ega-v9" &&
      typeof installed.version === "string" &&
      installed.version.length > 0 &&
      Boolean(requestedDependency),
    {
      installedName:
        installed.name,
      installedVersion:
        installed.version,
      requestedDependency:
        typeof requestedDependency === "string" &&
        requestedDependency.startsWith("file:")
          ? "<local-tarball>"
          : requestedDependency,
    }
  );

  /*
   * Test 3
   * CommonJS import.
   */
  let cjsModule;
  let cjsError;

  try {
    cjsModule =
      require("ega-v9");
  } catch (error) {
    cjsError = error;
  }

  const cjsExports =
    cjsModule
      ? Object.keys(cjsModule).sort()
      : [];

  record(
    3,
    "CommonJS import succeeds",
    !cjsError &&
      cjsModule &&
      typeof cjsModule === "object",
    {
      exports:
        cjsExports,
      error:
        cjsError?.message,
    }
  );

  /*
   * Test 4
   * ESM import.
   */
  let esmModule;
  let esmError;

  try {
    esmModule =
      await import("ega-v9");
  } catch (error) {
    esmError = error;
  }

  const esmExports =
    esmModule
      ? Object.keys(esmModule)
          .filter(
            name =>
              name !== "default"
          )
          .sort()
      : [];

  record(
    4,
    "ESM import succeeds",
    !esmError &&
      esmModule &&
      typeof esmModule === "object",
    {
      exports:
        esmExports,
      error:
        esmError?.message,
    }
  );

  /*
   * Test 5
   * CJS and ESM named exports align.
   */
  record(
    5,
    "CommonJS and ESM named exports match",
    sameStringSet(
      cjsExports,
      esmExports
    ),
    {
      commonjsExports:
        cjsExports,
      esmExports,
    }
  );

  /*
   * Test 6
   * Frozen API contract.
   */
  const contract =
    JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          "contracts",
          "public-api-v1.0.1.json"
        ),
        "utf8"
      )
    );

  const expectedExports =
    sortedUnique(
      extractExpectedExports(contract)
    );

  record(
    6,
    "Installed exports match official public API contract",
    expectedExports.length > 0 &&
      sameStringSet(
        cjsExports,
        expectedExports
      ),
    {
      expectedExports,
      installedExports:
        cjsExports,
    }
  );

  /*
   * Test 7
   * CommonJS public example.
   */
  const commonjsExample =
    runNode(
      path.join(
        ROOT,
        "examples",
        "commonjs",
        "basic.cjs"
      )
    );

  record(
    7,
    "CommonJS example executes successfully",
    commonjsExample.status === 0,
    {
      exitCode:
        commonjsExample.status,
      stdout:
        commonjsExample.stdout,
      stderr:
        commonjsExample.stderr,
    }
  );

  /*
   * Test 8
   * ESM public example.
   */
  const esmExample =
    runNode(
      path.join(
        ROOT,
        "examples",
        "esm",
        "basic.mjs"
      )
    );

  record(
    8,
    "ESM example executes successfully",
    esmExample.status === 0,
    {
      exitCode:
        esmExample.status,
      stdout:
        esmExample.stdout,
      stderr:
        esmExample.stderr,
    }
  );

  /*
   * Test 9
   * TypeScript consumer compilation.
   */
  const tsCompile =
    spawnSync(
      process.platform === "win32"
        ? "npx.cmd"
        : "npx",
      [
        "tsc",
        "-p",
        "examples/typescript/tsconfig.json",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
      }
    );

  record(
    9,
    "TypeScript consumer compiles successfully",
    tsCompile.status === 0,
    {
      exitCode:
        tsCompile.status,
      stdout:
        tsCompile.stdout,
      stderr:
        tsCompile.stderr,
    }
  );

  /*
   * Test 10
   * Compiled TypeScript example execution.
   */
  const compiledCandidates = [
    path.join(
      ROOT,
      "examples",
      "typescript",
      "dist",
      "basic.mjs"
    ),
    path.join(
      ROOT,
      "examples",
      "typescript",
      "dist",
      "basic.js"
    ),
  ];

  const compiledFile =
    compiledCandidates.find(
      candidate =>
        fs.existsSync(candidate)
    );

  const tsExecution =
    compiledFile
      ? runNode(compiledFile)
      : {
          status: 1,
          stdout: "",
          stderr:
            "Compiled TypeScript output was not found.",
        };

  record(
    10,
    "Compiled TypeScript example executes successfully",
    Boolean(compiledFile) &&
      tsExecution.status === 0,
    {
      compiledFile:
        compiledFile
          ? path.relative(
              ROOT,
              compiledFile
            )
          : null,
      exitCode:
        tsExecution.status,
      stdout:
        tsExecution.stdout,
      stderr:
        tsExecution.stderr,
    }
  );

  /*
   * Test 11
   * Production npm audit.
   */
  let audit;
  let auditError;

  try {
    audit =
      JSON.parse(
        execFileSync(
          "npm",
          [
            "audit",
            "--omit=dev",
            "--json",
          ],
          {
            cwd: ROOT,
            encoding: "utf8",
            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
          }
        )
      );
  } catch (error) {
    const output =
      error.stdout?.toString() ||
      "";

    try {
      audit =
        JSON.parse(output);
    } catch {
      auditError =
        error.message;
    }
  }

  const vulnerabilities =
    audit?.metadata?.vulnerabilities ||
    {};

  const vulnerabilityTotal =
    typeof vulnerabilities.total ===
      "number"
      ? vulnerabilities.total
      : Object.entries(vulnerabilities)
          .filter(
            ([key]) =>
              key !== "total"
          )
          .reduce(
            (sum, [, value]) =>
              sum +
              (
                typeof value ===
                "number"
                  ? value
                  : 0
              ),
            0
          );

  record(
    11,
    "Production npm audit reports zero vulnerabilities",
    vulnerabilityTotal === 0 &&
      !auditError,
    {
      vulnerabilities,
      vulnerabilityTotal,
      error:
        auditError,
    }
  );

  /*
   * Test 12
   * Installed package hygiene and local path leakage.
   */
  function listFiles(directory) {
    const output = [];

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
          output.push(
            path.relative(
              PACKAGE_DIR,
              fullPath
            )
          );
        }
      }
    }

    walk(directory);

    return output.sort();
  }

  const installedFiles =
    listFiles(PACKAGE_DIR);

  const forbiddenPatterns = [
    /^src\//,
    /^test\//,
    /^tests\//,
    /^scripts\//,
    /^audit\//,
    /^publication\//,
    /^node_modules\//,
    /\.DS_Store$/,
    /\.before-/,
    /\.bak$/,
    /\.tmp$/,
  ];

  const forbiddenFiles =
    installedFiles.filter(
      file =>
        forbiddenPatterns.some(
          pattern =>
            pattern.test(file)
        )
    );

  const textExtensions =
    new Set([
      ".js",
      ".mjs",
      ".cjs",
      ".json",
      ".md",
      ".d.ts",
      ".ts",
      ".txt",
    ]);

  const localPathMatches = [];

  for (const relativeFile of installedFiles) {
    const extension =
      path.extname(relativeFile);

    if (
      !textExtensions.has(extension) &&
      !relativeFile.endsWith(".d.ts")
    ) {
      continue;
    }

    const fullPath =
      path.join(
        PACKAGE_DIR,
        relativeFile
      );

    const text =
      fs.readFileSync(
        fullPath,
        "utf8"
      );

    const patterns = [
      /\/Users\/[^/\s]+/g,
      /\/home\/[^/\s]+/g,
      /[A-Za-z]:\\Users\\[^\\\s]+/g,
      /ega-v9-v1\.0\.1-fresh-consumer/g,
    ];

    for (const pattern of patterns) {
      const matches =
        text.match(pattern) || [];

      for (const match of matches) {
        localPathMatches.push({
          file:
            relativeFile,
          match,
        });
      }
    }
  }

  record(
    12,
    "Installed package contains no forbidden files or local paths",
    forbiddenFiles.length === 0 &&
      localPathMatches.length === 0,
    {
      installedFiles,
      forbiddenFiles,
      localPathMatches,
    }
  );

  const failed =
    results.filter(
      result =>
        !result.pass
    );

  const summary = {
    finalStatus:
      failed.length === 0
        ? "PASS"
        : "BLOCKED",
    packageName:
      installed.name,
    packageVersion:
      installed.version,
    totalTests:
      results.length,
    passedTests:
      results.length -
      failed.length,
    failedTests:
      failed.length,
    failedTestNumbers:
      failed.map(
        result =>
          result.number
      ),
  };

  const evidence = {
    schemaVersion:
      "1.0",
    generatedAt:
      new Date().toISOString(),
    environment: {
      node:
        process.version,
      platform:
        process.platform,
      architecture:
        process.arch,
    },
    summary,
    tests:
      results,
  };

  fs.writeFileSync(
    EVIDENCE_PATH,
    JSON.stringify(
      evidence,
      null,
      2
    ) + "\n"
  );

  console.log("\nSUMMARY");
  console.log(summary);

  if (failed.length > 0) {
    console.error(
      "\nFRESH_CONSUMER_12_TEST_GATE=BLOCKED"
    );

    process.exit(1);
  }

  console.log(
    "\nFRESH_CONSUMER_12_TEST_GATE=PASS"
  );
}

main().catch(error => {
  console.error(error);

  process.exit(1);
});
