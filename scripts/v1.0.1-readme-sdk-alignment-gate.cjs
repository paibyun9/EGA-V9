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

const rootPackagePath =
  path.join(root, "package.json");

const sdkPackagePath =
  path.join(
    sdkRoot,
    "package.json"
  );

const declarationPath =
  path.join(
    sdkRoot,
    "dist",
    "index.d.ts"
  );

const readmeFiles = [
  {
    id: "root",
    path: path.join(
      root,
      "README.md"
    ),
  },
  {
    id: "sdk",
    path: path.join(
      sdkRoot,
      "README.md"
    ),
  },
  {
    id: "examples",
    path: path.join(
      root,
      "examples",
      "README.md"
    ),
  },
];

const expectedExports = [
  "EGA",
  "contain",
  "ega",
  "provenance",
  "replay",
  "verifyExecution",
].sort();

const evidencePath =
  path.join(
    root,
    "publication",
    "evidence",
    "v1.0.1",
    "readme-sdk-alignment.json"
  );

const workRoot =
  path.join(
    os.tmpdir(),
    "ega-v9-v1.0.1-readme-sdk-alignment"
  );

const packageDirectory =
  path.join(
    workRoot,
    "package"
  );

const consumerDirectory =
  path.join(
    workRoot,
    "consumer"
  );

const checks = [];

function record(
  name,
  pass,
  details = {}
) {
  const check = {
    name,
    pass: Boolean(pass),
    ...details,
  };

  checks.push(check);

  console.log(
    `${check.pass ? "✅" : "❌"} ${name}`
  );

  return check.pass;
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

  const result =
    spawnSync(
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

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function finish(
  packageMetadata = {}
) {
  const finalStatus =
    checks.every(
      (check) => check.pass
    )
      ? "PASS"
      : "BLOCKED";

  const evidence = {
    schemaVersion: "1.0.0",
    releaseTarget:
      "ega-v9@1.0.1",
    testId:
      "readme-sdk-alignment",
    generatedAt:
      new Date().toISOString(),
    nodeVersion:
      process.version,
    platform:
      `${os.platform()}-${os.arch()}`,
    packageMetadata,
    expectedExports,
    checks,
    summary: {
      totalChecks:
        checks.length,
      passedChecks:
        checks.filter(
          (check) => check.pass
        ).length,
      failedChecks:
        checks.filter(
          (check) => !check.pass
        ).length,
    },
    finalStatus,
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

  console.log();
  console.log(
    `Evidence: ${evidencePath}`
  );

  console.log(
    `README SDK Alignment Gate: ${finalStatus}`
  );

  process.exitCode =
    finalStatus === "PASS"
      ? 0
      : 1;
}

console.log(
  "EGA V9 v1.0.1 README SDK Alignment Gate"
);

for (const readme of readmeFiles) {
  record(
    `README exists: ${readme.id}`,
    fs.existsSync(readme.path),
    {
      path:
        path.relative(
          root,
          readme.path
        ),
    }
  );
}

if (
  checks.some(
    (check) => !check.pass
  )
) {
  finish();
  return;
}

const rootPackage =
  readJson(rootPackagePath);

const sdkPackage =
  readJson(sdkPackagePath);

const packageMetadata = {
  rootName:
    rootPackage.name ?? null,
  rootVersion:
    rootPackage.version ?? null,
  sdkName:
    sdkPackage.name ?? null,
  sdkVersion:
    sdkPackage.version ?? null,
  main:
    sdkPackage.main ?? null,
  module:
    sdkPackage.module ?? null,
  types:
    sdkPackage.types ?? null,
};

record(
  "SDK package name is ega-v9",
  sdkPackage.name === "ega-v9",
  {
    observed:
      sdkPackage.name ?? null,
  }
);

record(
  "Root and SDK versions match",
  rootPackage.version ===
    sdkPackage.version,
  {
    rootVersion:
      rootPackage.version ?? null,
    sdkVersion:
      sdkPackage.version ?? null,
  }
);

const exportsField =
  sdkPackage.exports?.["."];

record(
  "Package CommonJS export condition exists",
  typeof exportsField?.require ===
    "string",
  {
    observed:
      exportsField?.require ?? null,
  }
);

record(
  "Package ESM export condition exists",
  typeof exportsField?.import ===
    "string",
  {
    observed:
      exportsField?.import ?? null,
  }
);

record(
  "Package TypeScript export condition exists",
  typeof exportsField?.types ===
    "string",
  {
    observed:
      exportsField?.types ?? null,
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
  finish(packageMetadata);
  return;
}

record(
  "TypeScript declaration exists",
  fs.existsSync(
    declarationPath
  )
);

if (
  !fs.existsSync(
    declarationPath
  )
) {
  finish(packageMetadata);
  return;
}

const declaration =
  fs.readFileSync(
    declarationPath,
    "utf8"
  );

const requiredDeclarationPatterns = [
  {
    name:
      "Declaration includes supported trust level",
    pattern:
      /["']supported["']/,
  },
  {
    name:
      "Declaration includes verified trust level",
    pattern:
      /["']verified["']/,
  },
  {
    name:
      "Declaration includes requestId",
    pattern:
      /\brequestId\s*:/,
  },
  {
    name:
      "Declaration includes replayRoot",
    pattern:
      /\breplayRoot\s*:/,
  },
  {
    name:
      "Declaration includes containment object",
    pattern:
      /\bcontainment\s*:/,
  },
  {
    name:
      "Declaration includes nested executionAllowed",
    pattern:
      /\bexecutionAllowed\s*:/,
  },
];

for (
  const contractCheck of
  requiredDeclarationPatterns
) {
  record(
    contractCheck.name,
    contractCheck.pattern.test(
      declaration
    )
  );
}

const readmes =
  Object.fromEntries(
    readmeFiles.map(
      (readme) => [
        readme.id,
        fs.readFileSync(
          readme.path,
          "utf8"
        ),
      ]
    )
  );

const combinedReadmes =
  Object.values(readmes).join(
    "\n\n"
  );

for (const readme of readmeFiles) {
  const content =
    readmes[readme.id];

  record(
    `${readme.id} README is not empty`,
    content.trim().length > 0
  );

  record(
    `${readme.id} README has no internal SDK import`,
    !/packages\/sdk-ts\/dist\/index|src\/index|\.\.\/\.\.\/packages\/sdk-ts/.test(
      content
    )
  );
}

record(
  "Documentation includes npm install ega-v9",
  /npm\s+(?:install|i)\s+ega-v9\b/.test(
    combinedReadmes
  )
);

record(
  "Documentation includes CommonJS public package import",
  /require\(\s*["']ega-v9["']\s*\)/.test(
    combinedReadmes
  )
);

record(
  "Documentation includes ESM public package import",
  /from\s+["']ega-v9["']/.test(
    combinedReadmes
  )
);

record(
  "Documentation identifies TypeScript support",
  /\bTypeScript\b/i.test(
    combinedReadmes
  )
);

for (const exportedName of expectedExports) {
  const escapedName =
    exportedName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  record(
    `Documentation mentions public export: ${exportedName}`,
    new RegExp(
      `\\b${escapedName}\\b`
    ).test(
      combinedReadmes
    )
  );
}

const forbiddenPatterns = [
  {
    name:
      'Obsolete trustLevel "T1"',
    pattern:
      /trustLevel\s*:\s*["']T1["']/,
  },
  {
    name:
      'Obsolete trustLevel "T2"',
    pattern:
      /trustLevel\s*:\s*["']T2["']/,
  },
  {
    name:
      'Obsolete trustLevel "T3"',
    pattern:
      /trustLevel\s*:\s*["']T3["']/,
  },
  {
    name:
      "Invalid verification.workflowId",
    pattern:
      /\bverification\.workflowId\b/,
  },
  {
    name:
      "Invalid verification.replayConsistency",
    pattern:
      /\bverification\.replayConsistency\b/,
  },
  {
    name:
      "Invalid verification.trustState",
    pattern:
      /\bverification\.trustState\b/,
  },
  {
    name:
      "Invalid verification.containmentRequired",
    pattern:
      /\bverification\.containmentRequired\b/,
  },
  {
    name:
      "Invalid flat verification.executionAllowed",
    pattern:
      /\bverification\.executionAllowed\b/,
  },
  {
    name:
      "Obsolete CommonJS-only claim",
    pattern:
      /\bCommonJS[\s-]+only\b/i,
  },
  {
    name:
      "Obsolete ESM unsupported claim",
    pattern:
      /\bESM\b.{0,40}\b(?:unsupported|not supported)\b/i,
  },
];

for (
  const forbidden of
  forbiddenPatterns
) {
  const matches = [];

  for (const readme of readmeFiles) {
    const content =
      readmes[readme.id];

    if (
      forbidden.pattern.test(
        content
      )
    ) {
      matches.push(
        readme.id
      );
    }
  }

  record(
    `No forbidden README contract: ${forbidden.name}`,
    matches.length === 0,
    {
      matchedReadmes:
        matches,
    }
  );
}

const documentedTrustLevels = [
  ...combinedReadmes.matchAll(
    /trustLevel\\s*:\\s*["']([^"']+)["']/g
  ),
].map(
  (match) => match[1]
);

const invalidDocumentedTrustLevels =
  documentedTrustLevels.filter(
    (value) =>
      value !== "supported" &&
      value !== "verified"
  );

record(
  "Any documented trustLevel uses a valid SDK value",
  invalidDocumentedTrustLevels.length === 0,
  {
    trustLevelOptional: true,
    documentedTrustLevels,
    invalidDocumentedTrustLevels,
  }
);

const supportedResultFields = [
  "verification.requestId",
  "verification.replayRoot",
  "verification.trustLevel",
  "verification.status",
  "verification.containment.activated",
  "verification.containment.executionAllowed",
];

for (
  const resultField of
  supportedResultFields
) {
  record(
    `Documentation contract supports field: ${resultField}`,
    declaration.includes(
      resultField
        .replace(
          "verification.",
          ""
        )
        .split(".")
        .at(-1)
    ),
    {
      field:
        resultField,
    }
  );
}

const versionPattern =
  /\bega-v9@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/g;

const documentedVersions = [];

for (const readme of readmeFiles) {
  for (
    const match of
    readmes[readme.id].matchAll(
      versionPattern
    )
  ) {
    documentedVersions.push({
      readme:
        readme.id,
      version:
        match[1],
    });
  }
}

const mismatchedVersions =
  documentedVersions.filter(
    (entry) =>
      entry.version !==
      sdkPackage.version
  );

record(
  "Any explicit README package versions match SDK package.json",
  mismatchedVersions.length === 0,
  {
    sdkVersion:
      sdkPackage.version,
    documentedVersions,
    mismatchedVersions,
  }
);

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
  finish(packageMetadata);
  return;
}

let packData;

try {
  packData =
    JSON.parse(
      packResult.stdout
    );

  record(
    "Parse npm pack output",
    true
  );
} catch (error) {
  record(
    "Parse npm pack output",
    false,
    {
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  );

  finish(packageMetadata);
  return;
}

const tarballFilename =
  packData?.[0]?.filename;

const tarballPath =
  typeof tarballFilename ===
  "string"
    ? path.join(
        packageDirectory,
        tarballFilename
      )
    : "";

record(
  "Generated SDK tarball exists",
  Boolean(
    tarballPath &&
    fs.existsSync(
      tarballPath
    )
  ),
  {
    tarball:
      tarballFilename ?? null,
  }
);

if (
  !tarballPath ||
  !fs.existsSync(
    tarballPath
  )
) {
  finish(packageMetadata);
  return;
}

fs.writeFileSync(
  path.join(
    consumerDirectory,
    "package.json"
  ),
  `${JSON.stringify(
    {
      name:
        "ega-v9-readme-sdk-alignment-consumer",
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
  "Install packed SDK and TypeScript",
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
    "typescript",
  ],
  consumerDirectory
);

if (
  installResult.status !== 0
) {
  finish(packageMetadata);
  return;
}

const cjsSmokePath =
  path.join(
    consumerDirectory,
    "readme-smoke.cjs"
  );

fs.writeFileSync(
  cjsSmokePath,
  `"use strict";

const assert =
  require("node:assert/strict");

const {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} = require("ega-v9");

const expectedExports = [
  "EGA",
  "contain",
  "ega",
  "provenance",
  "replay",
  "verifyExecution",
].sort();

assert.deepEqual(
  Object.keys(
    require("ega-v9")
  ).sort(),
  expectedExports
);

const engine = EGA.init({
  appName:
    "readme-cjs-smoke",
  trustLevel:
    "supported",
});

const workflow = {
  workflowId:
    "readme-cjs-workflow",
  action:
    "verify",
  amount:
    100,
};

const verification =
  verifyExecution(workflow);

const replayResult =
  replay(workflow);

const provenanceResult =
  provenance(workflow);

const containmentResult =
  contain(workflow);

assert.ok(engine);
assert.equal(
  typeof ega.guard,
  "function"
);
assert.equal(
  typeof verification.requestId,
  "string"
);
assert.equal(
  typeof verification.replayRoot,
  "string"
);
assert.ok(
  ["supported", "verified"].includes(
    verification.trustLevel
  )
);
assert.equal(
  typeof verification.status,
  "string"
);
assert.equal(
  typeof verification.containment,
  "object"
);
assert.equal(
  typeof verification.containment.activated,
  "boolean"
);
assert.equal(
  typeof verification.containment.executionAllowed,
  "boolean"
);
assert.ok(replayResult);
assert.ok(provenanceResult);
assert.ok(containmentResult);

console.log(
  "README CommonJS contract: PASS"
);
`,
  "utf8"
);

const esmSmokePath =
  path.join(
    consumerDirectory,
    "readme-smoke.mjs"
  );

fs.writeFileSync(
  esmSmokePath,
  `import assert from "node:assert/strict";

import defaultExport, {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} from "ega-v9";

assert.equal(
  defaultExport.EGA,
  EGA
);

assert.equal(
  defaultExport.ega,
  ega
);

const engine = EGA.init({
  appName:
    "readme-esm-smoke",
  trustLevel:
    "verified",
});

const workflow = {
  workflowId:
    "readme-esm-workflow",
  action:
    "verify",
  amount:
    100,
};

const verification =
  verifyExecution(workflow);

assert.ok(engine);
assert.equal(
  typeof ega.guard,
  "function"
);
assert.equal(
  typeof verification.requestId,
  "string"
);
assert.equal(
  typeof verification.replayRoot,
  "string"
);
assert.ok(
  ["supported", "verified"].includes(
    verification.trustLevel
  )
);
assert.ok(
  replay(workflow)
);
assert.ok(
  provenance(workflow)
);
assert.ok(
  contain(workflow)
);

console.log(
  "README ESM contract: PASS"
);
`,
  "utf8"
);

const tsSmokePath =
  path.join(
    consumerDirectory,
    "readme-smoke.mts"
  );

fs.writeFileSync(
  tsSmokePath,
  `import {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} from "ega-v9";

const engine = EGA.init({
  appName:
    "readme-typescript-smoke",
  trustLevel:
    "supported",
});

const workflow = {
  workflowId:
    "readme-typescript-workflow",
  action:
    "verify",
  amount:
    100,
};

const verification =
  verifyExecution(workflow);

if (
  typeof ega.guard !==
  "function"
) {
  throw new Error(
    "ega.guard unavailable"
  );
}

const requestId: string =
  verification.requestId;

const replayRoot: string =
  verification.replayRoot;

const executionAllowed: boolean =
  verification.containment.executionAllowed;

if (
  !engine ||
  !requestId ||
  !replayRoot ||
  typeof executionAllowed !==
    "boolean" ||
  !replay(workflow) ||
  !provenance(workflow) ||
  !contain(workflow)
) {
  throw new Error(
    "README TypeScript contract failed"
  );
}

console.log(
  "README TypeScript contract: PASS"
);
`,
  "utf8"
);

fs.writeFileSync(
  path.join(
    consumerDirectory,
    "tsconfig.json"
  ),
  `${JSON.stringify(
    {
      compilerOptions: {
        target:
          "ES2022",
        module:
          "Node16",
        moduleResolution:
          "Node16",
        strict:
          true,
        noEmitOnError:
          true,
        outDir:
          "./dist",
        skipLibCheck:
          false,
      },
      include: [
        "./readme-smoke.mts",
      ],
    },
    null,
    2
  )}\n`,
  "utf8"
);

run(
  "Fresh CommonJS README contract",
  "node",
  [
    "readme-smoke.cjs",
  ],
  consumerDirectory
);

run(
  "Fresh ESM README contract",
  "node",
  [
    "readme-smoke.mjs",
  ],
  consumerDirectory
);

const tscPath =
  path.join(
    consumerDirectory,
    "node_modules",
    ".bin",
    "tsc"
  );

record(
  "Fresh TypeScript compiler exists",
  fs.existsSync(
    tscPath
  )
);

if (
  fs.existsSync(
    tscPath
  )
) {
  const compileResult = run(
    "Fresh TypeScript README contract compile",
    tscPath,
    [
      "--project",
      "tsconfig.json",
    ],
    consumerDirectory
  );

  if (
    compileResult.status === 0
  ) {
    run(
      "Fresh TypeScript README contract runtime",
      "node",
      [
        "dist/readme-smoke.mjs",
      ],
      consumerDirectory
    );
  } else {
    record(
      "Fresh TypeScript README contract runtime",
      false,
      {
        reason:
          "Compile failed",
      }
    );
  }
}

const installedSdk =
  require(
    path.join(
      consumerDirectory,
      "node_modules",
      "ega-v9"
    )
  );

const observedExports =
  Object.keys(
    installedSdk
  ).sort();

record(
  "Fresh installed SDK preserves frozen six exports",
  JSON.stringify(
    observedExports
  ) ===
    JSON.stringify(
      expectedExports
    ),
  {
    expectedExports,
    observedExports,
  }
);

finish(packageMetadata);
