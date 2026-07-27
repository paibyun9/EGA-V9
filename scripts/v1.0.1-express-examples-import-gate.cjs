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

const expressRoot = path.join(
  root,
  "examples",
  "express"
);

const workRoot = path.join(
  os.tmpdir(),
  "ega-v9-v1.0.1-express-examples-import-gate"
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
  "express-examples-imports.json"
);

const checks = [];

function record(
  name,
  pass,
  details = {}
) {
  checks.push({
    name,
    pass,
    ...details,
  });

  console.log(
    `${pass ? "✅" : "❌"} ${name}`
  );

  return pass;
}

function run(
  name,
  command,
  args,
  cwd
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

function finish() {
  const finalStatus =
    checks.every(
      (check) => check.pass
    )
      ? "PASS"
      : "BLOCKED";

  const evidence = {
    schemaVersion: "1.0.0",
    releaseTarget: "ega-v9@1.0.1",
    testId:
      "express-examples-public-package-imports",
    generatedAt:
      new Date().toISOString(),
    nodeVersion:
      process.version,
    platform:
      `${os.platform()}-${os.arch()}`,
    checks,
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
    `Express Examples Import Gate: ${finalStatus}`
  );

  process.exit(
    finalStatus === "PASS"
      ? 0
      : 1
  );
}

console.log(
  "EGA V9 v1.0.1 Express Examples Import Gate"
);

const sourceFiles = fs
  .readdirSync(expressRoot)
  .filter(
    (file) =>
      file.endsWith(".cjs") ||
      file.endsWith(".mjs")
  );

for (const file of sourceFiles) {
  const absolutePath =
    path.join(
      expressRoot,
      file
    );

  const source =
    fs.readFileSync(
      absolutePath,
      "utf8"
    );

  const hasInternalImport =
    /packages\/sdk-ts|dist\/index|src\/index|\.\.\/\.\.\/packages/.test(
      source
    );

  record(
    `No internal SDK import: ${file}`,
    !hasInternalImport
  );
}

if (
  checks.some(
    (check) => !check.pass
  )
) {
  finish();
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

const buildResult = run(
  "SDK build",
  "npm",
  [
    "run",
    "build",
  ],
  root
);

if (
  buildResult.status !== 0
) {
  finish();
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
  ],
  root
);

if (
  packResult.status !== 0
) {
  finish();
}

let packData;

try {
  packData =
    JSON.parse(
      packResult.stdout
    );
} catch {
  record(
    "Parse npm pack output",
    false
  );

  finish();
}

const packedFilename =
  packData?.[0]?.filename;

const tarballPath =
  typeof packedFilename === "string"
    ? path.join(
        packageDirectory,
        packedFilename
      )
    : "";

record(
  "Generated tarball exists",
  Boolean(
    tarballPath &&
    fs.existsSync(tarballPath)
  ),
  {
    tarball:
      packedFilename ?? null,
  }
);

if (
  !tarballPath ||
  !fs.existsSync(tarballPath)
) {
  finish();
}

fs.writeFileSync(
  path.join(
    consumerDirectory,
    "package.json"
  ),
  `${JSON.stringify(
    {
      name:
        "ega-v9-express-examples-consumer",
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
  "Install packed SDK and Express",
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
    "express",
  ],
  consumerDirectory
);

if (
  installResult.status !== 0
) {
  finish();
}

const copiedExpressRoot =
  path.join(
    consumerDirectory,
    "examples",
    "express"
  );

fs.mkdirSync(
  path.dirname(
    copiedExpressRoot
  ),
  {
    recursive: true,
  }
);

fs.cpSync(
  expressRoot,
  copiedExpressRoot,
  {
    recursive: true,
  }
);

record(
  "Express examples copied",
  fs.existsSync(
    path.join(
      copiedExpressRoot,
      "app.mjs"
    )
  )
);

const cjsResolutionResult = run(
  "CommonJS public package resolution",
  "node",
  [
    "-e",
    `
      const sdk =
        require("ega-v9");

      if (
        typeof sdk.EGA?.init !==
        "function"
      ) {
        throw new Error(
          "EGA.init unavailable"
        );
      }

      console.log(
        "CJS EGA package import: PASS"
      );
    `,
  ],
  consumerDirectory
);

const esmAppImportResult = run(
  "ESM Express app import",
  "node",
  [
    "--input-type=module",
    "-e",
    `
      const module =
        await import(
          "./examples/express/app.mjs"
        );

      if (
        typeof module.createCheckoutApp !==
        "function"
      ) {
        throw new Error(
          "createCheckoutApp unavailable"
        );
      }

      const app =
        module.createCheckoutApp();

      if (
        typeof app !== "function"
      ) {
        throw new Error(
          "Express app was not created"
        );
      }

      console.log(
        "ESM Express app import: PASS"
      );
    `,
  ],
  consumerDirectory
);

record(
  "CommonJS smoke completed",
  cjsResolutionResult.status === 0
);

record(
  "ESM app smoke completed",
  esmAppImportResult.status === 0
);

finish();
