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

const examplesRoot = path.join(
  root,
  "examples"
);

const workRoot = path.join(
  os.tmpdir(),
  "ega-v9-v1.0.1-examples-gate"
);

const packageDirectory = path.join(
  workRoot,
  "package"
);

const consumerDirectory = path.join(
  workRoot,
  "consumer"
);

const evidencePath = path.join(
  root,
  "publication",
  "evidence",
  "v1.0.1",
  "executable-examples.json"
);

const auditDirectory = path.join(
  root,
  "audit",
  "v1.0.1",
  "step-7"
);

const expectedExports = [
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
  const entry = {
    name,
    pass,
    ...details,
  };

  results.push(entry);

  console.log(
    `${pass ? "✅" : "❌"} ${name}`
  );

  return pass;
}

function run(
  name,
  command,
  args,
  cwd = root
) {
  console.log();
  console.log(
    `$ ${command} ${args.join(" ")}`
  );

  const result = spawnSync(
    command,
    args,
    {
      cwd,
      encoding: "utf8",
      shell: false,
      env: {
        ...process.env,
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

  record(
    name,
    result.status === 0,
    {
      exitCode:
        result.status ?? 1,
    }
  );

  return result;
}

function failAndWriteEvidence(
  reason
) {
  const evidence = {
    schemaVersion: "1.0.0",
    releaseTarget: "ega-v9@1.0.1",
    testId: "executable-examples",
    generatedAt:
      new Date().toISOString(),
    nodeVersion:
      process.version,
    platform:
      `${os.platform()}-${os.arch()}`,
    expectedExports,
    results,
    reason,
    finalStatus: "BLOCKED",
  };

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

  console.error();
  console.error(
    `Examples Gate: BLOCKED — ${reason}`
  );

  process.exit(1);
}

console.log(
  "EGA V9 v1.0.1 Executable Examples Gate"
);

const requiredExampleFiles = [
  "README.md",
  path.join(
    "commonjs",
    "basic.cjs"
  ),
  path.join(
    "esm",
    "basic.mjs"
  ),
  path.join(
    "typescript",
    "basic.mts"
  ),
  path.join(
    "typescript",
    "tsconfig.json"
  ),
];

for (
  const relativeFile
  of requiredExampleFiles
) {
  const absoluteFile =
    path.join(
      examplesRoot,
      relativeFile
    );

  record(
    `Example file exists: ${relativeFile}`,
    fs.existsSync(
      absoluteFile
    )
  );
}

if (
  results.some(
    (result) => !result.pass
  )
) {
  failAndWriteEvidence(
    "One or more example files are missing."
  );
}

fs.rmSync(
  workRoot,
  {
    recursive: true,
    force: true,
  }
);

fs.mkdirSync(
  packageDirectory,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  consumerDirectory,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  auditDirectory,
  {
    recursive: true,
  }
);

const buildResult = run(
  "SDK build",
  "npm",
  [
    "run",
    "build",
  ]
);

if (
  buildResult.status !== 0
) {
  failAndWriteEvidence(
    "SDK build failed."
  );
}

const packResult = run(
  "SDK npm pack",
  "npm",
  [
    "pack",
    sdkRoot,
    "--pack-destination",
    packageDirectory,
    "--json",
  ]
);

if (
  packResult.status !== 0
) {
  failAndWriteEvidence(
    "npm pack failed."
  );
}

let packData;

try {
  packData = JSON.parse(
    packResult.stdout
  );
} catch {
  failAndWriteEvidence(
    "npm pack JSON output could not be parsed."
  );
}

const packedFilename =
  packData?.[0]?.filename;

if (
  typeof packedFilename !==
  "string"
) {
  failAndWriteEvidence(
    "Packed tarball filename was not returned."
  );
}

const tarballPath =
  path.join(
    packageDirectory,
    packedFilename
  );

record(
  "Generated tarball exists",
  fs.existsSync(
    tarballPath
  ),
  {
    tarball:
      packedFilename,
  }
);

if (
  !fs.existsSync(
    tarballPath
  )
) {
  failAndWriteEvidence(
    "Generated tarball is missing."
  );
}

fs.writeFileSync(
  path.join(
    consumerDirectory,
    "package.json"
  ),
  `${JSON.stringify(
    {
      name:
        "ega-v9-examples-consumer",
      version:
        "1.0.0",
      private:
        true,
      type:
        "module",
    },
    null,
    2
  )}\n`,
  "utf8"
);

const installResult = run(
  "Install packed SDK",
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ],
  consumerDirectory
);

if (
  installResult.status !== 0
) {
  failAndWriteEvidence(
    "Packed SDK installation failed."
  );
}

const installedPackageJsonPath =
  path.join(
    consumerDirectory,
    "node_modules",
    "ega-v9",
    "package.json"
  );

record(
  "Installed package.json exists",
  fs.existsSync(
    installedPackageJsonPath
  )
);

if (
  !fs.existsSync(
    installedPackageJsonPath
  )
) {
  failAndWriteEvidence(
    "Installed ega-v9 package is missing."
  );
}

const installedPackage =
  JSON.parse(
    fs.readFileSync(
      installedPackageJsonPath,
      "utf8"
    )
  );

record(
  "Installed CommonJS entry exists",
  fs.existsSync(
    path.join(
      consumerDirectory,
      "node_modules",
      "ega-v9",
      "dist",
      "index.js"
    )
  )
);

record(
  "Installed ESM entry exists",
  fs.existsSync(
    path.join(
      consumerDirectory,
      "node_modules",
      "ega-v9",
      "dist",
      "index.mjs"
    )
  )
);

record(
  "Installed TypeScript declaration exists",
  fs.existsSync(
    path.join(
      consumerDirectory,
      "node_modules",
      "ega-v9",
      "dist",
      "index.d.ts"
    )
  )
);

const consumerExamples =
  path.join(
    consumerDirectory,
    "examples"
  );

fs.cpSync(
  examplesRoot,
  consumerExamples,
  {
    recursive: true,
  }
);

record(
  "Examples copied to isolated consumer",
  fs.existsSync(
    path.join(
      consumerExamples,
      "commonjs",
      "basic.cjs"
    )
  )
);

const cjsResult = run(
  "Run CommonJS example",
  "node",
  [
    path.join(
      "examples",
      "commonjs",
      "basic.cjs"
    ),
  ],
  consumerDirectory
);

const esmResult = run(
  "Run ESM example",
  "node",
  [
    path.join(
      "examples",
      "esm",
      "basic.mjs"
    ),
  ],
  consumerDirectory
);

const compiledTypeScriptDirectory =
  path.join(
    consumerDirectory,
    "examples",
    "typescript",
    "dist"
  );

fs.rmSync(
  compiledTypeScriptDirectory,
  {
    recursive: true,
    force: true,
  }
);

const rootTsc =
  path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "tsc.cmd"
      : "tsc"
  );

record(
  "Repository TypeScript compiler exists",
  fs.existsSync(
    rootTsc
  )
);

let typeScriptCompileResult = {
  status: 1,
};

if (
  fs.existsSync(
    rootTsc
  )
) {
  typeScriptCompileResult = run(
    "Compile TypeScript example",
    rootTsc,
    [
      "--project",
      path.join(
        "examples",
        "typescript",
        "tsconfig.json"
      ),
    ],
    consumerDirectory
  );
}

const compiledTypeScriptExample =
  path.join(
    consumerDirectory,
    "examples",
    "typescript",
    "dist",
    "basic.mjs"
  );

record(
  "Compiled TypeScript example exists",
  fs.existsSync(
    compiledTypeScriptExample
  )
);

let typeScriptRuntimeResult = {
  status: 1,
};

if (
  fs.existsSync(
    compiledTypeScriptExample
  )
) {
  typeScriptRuntimeResult = run(
    "Run compiled TypeScript example",
    "node",
    [
      compiledTypeScriptExample,
    ],
    consumerDirectory
  );
}

const installedExportsResult =
  spawnSync(
    "node",
    [
      "-e",
      `
        const sdk =
          require("ega-v9");

        process.stdout.write(
          JSON.stringify(
            Object.keys(sdk).sort()
          )
        );
      `,
    ],
    {
      cwd:
        consumerDirectory,
      encoding:
        "utf8",
      shell:
        false,
    }
  );

let installedExports = [];

if (
  installedExportsResult.status ===
  0
) {
  try {
    installedExports =
      JSON.parse(
        installedExportsResult.stdout
      );
  } catch {
    installedExports = [];
  }
}

record(
  "Installed package preserves frozen export set",
  JSON.stringify(
    installedExports
  ) ===
    JSON.stringify(
      expectedExports
    ),
  {
    observedExports:
      installedExports,
  }
);

const allPassed =
  results.every(
    (result) => result.pass
  ) &&
  cjsResult.status === 0 &&
  esmResult.status === 0 &&
  typeScriptCompileResult.status === 0 &&
  typeScriptRuntimeResult.status === 0;

const evidence = {
  schemaVersion: "1.0.0",
  releaseTarget: "ega-v9@1.0.1",
  testId: "executable-examples",
  generatedAt:
    new Date().toISOString(),
  nodeVersion:
    process.version,
  platform:
    `${os.platform()}-${os.arch()}`,
  packageVersion:
    installedPackage.version ??
    null,
  expectedExports,
  observedExports:
    installedExports,
  examples: {
    commonjs: {
      runtimePass:
        cjsResult.status === 0,
    },
    esm: {
      runtimePass:
        esmResult.status === 0,
    },
    typescript: {
      compilePass:
        typeScriptCompileResult.status ===
        0,
      runtimePass:
        typeScriptRuntimeResult.status ===
        0,
    },
  },
  checks:
    results,
  finalStatus:
    allPassed
      ? "PASS"
      : "BLOCKED",
};

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

fs.writeFileSync(
  path.join(
    auditDirectory,
    "examples-gate-summary.json"
  ),
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
  `Executable Examples Gate: ${evidence.finalStatus}`
);

if (
  evidence.finalStatus !==
  "PASS"
) {
  process.exit(1);
}
