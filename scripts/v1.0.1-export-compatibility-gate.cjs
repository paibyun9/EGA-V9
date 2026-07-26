"use strict";

const {
  spawnSync,
} = require("node:child_process");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(
  __dirname,
  ".."
);

const sdkRoot = path.join(
  root,
  "packages",
  "sdk-ts"
);

const expectedNamedExports = [
  "EGA",
  "contain",
  "ega",
  "provenance",
  "replay",
  "verifyExecution",
].sort();

const results = [];

function record(
  name,
  pass,
  details = {}
) {
  results.push({
    name,
    pass,
    ...details,
  });

  console.log(
    `${pass ? "✅" : "❌"} ${name}`
  );
}

function run(
  name,
  command,
  args,
  cwd = root
) {
  console.log();
  console.log(
    `${
      command
    } ${
      args.join(" ")
    }`
  );

  const result = spawnSync(
    command,
    args,
    {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      shell: false,
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

  const pass =
    result.status === 0;

  record(name, pass, {
    exitCode:
      result.status ?? 1,
  });

  return result;
}

console.log(
  "EGA V9 v1.0.1 Export Compatibility Gate"
);

const build = run(
  "SDK build",
  "npm",
  ["run", "build"]
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const packageJsonPath =
  path.join(
    sdkRoot,
    "package.json"
  );

const packageJson = JSON.parse(
  fs.readFileSync(
    packageJsonPath,
    "utf8"
  )
);

record(
  "CommonJS package entry",
  packageJson.main ===
    "./dist/index.js"
);

record(
  "ESM package entry",
  packageJson.module ===
    "./dist/index.mjs"
);

record(
  "TypeScript declaration entry",
  packageJson.types ===
    "./dist/index.d.ts"
);

record(
  "Require export condition",
  packageJson.exports
    ?.["."]
    ?.require ===
    "./dist/index.js"
);

record(
  "Import export condition",
  packageJson.exports
    ?.["."]
    ?.import ===
    "./dist/index.mjs"
);

record(
  "Types export condition",
  packageJson.exports
    ?.["."]
    ?.types ===
    "./dist/index.d.ts"
);

for (const file of [
  "dist/index.js",
  "dist/index.mjs",
  "dist/index.d.ts",
]) {
  record(
    `${file} exists`,
    fs.existsSync(
      path.join(
        sdkRoot,
        file
      )
    )
  );
}

const cjsModule = require(
  path.join(
    sdkRoot,
    "dist",
    "index.js"
  )
);

record(
  "CommonJS frozen export set",
  JSON.stringify(
    Object.keys(cjsModule).sort()
  ) ===
    JSON.stringify(
      expectedNamedExports
    ),
  {
    exports:
      Object.keys(cjsModule).sort(),
  }
);

const localTests = run(
  "Local CJS and ESM tests",
  "node",
  [
    "--test",
    "packages/sdk-ts/test/export-compatibility/commonjs-export.test.cjs",
    "packages/sdk-ts/test/export-compatibility/esm-export.test.mjs",
  ]
);

const evidence = {
  schemaVersion: "1.0.0",
  releaseTarget: "ega-v9@1.0.1",
  testId:
    "commonjs-typescript-esm-export-compatibility",
  generatedAt:
    new Date().toISOString(),
  nodeVersion:
    process.version,
  platform:
    `${os.platform()}-${os.arch()}`,
  expectedNamedExports,
  packageEntries: {
    main:
      packageJson.main ?? null,
    module:
      packageJson.module ?? null,
    types:
      packageJson.types ?? null,
    exports:
      packageJson.exports ?? null,
  },
  checks: results,
  finalStatus:
    results.every(
      (result) => result.pass
    )
      ? "PASS"
      : "BLOCKED",
};

const evidencePath =
  path.join(
    root,
    "publication",
    "evidence",
    "v1.0.1",
    "export-compatibility.json"
  );

fs.mkdirSync(
  path.dirname(evidencePath),
  {
    recursive: true,
  }
);

fs.writeFileSync(
  evidencePath,
  `${JSON.stringify(
    evidence,
    null,
    2
  )}\n`,
  "utf8"
);

console.log();
console.log(
  `Evidence: ${evidencePath}`
);
console.log(
  `Export Compatibility Gate: ${evidence.finalStatus}`
);

if (
  evidence.finalStatus !==
  "PASS"
) {
  process.exit(1);
}
