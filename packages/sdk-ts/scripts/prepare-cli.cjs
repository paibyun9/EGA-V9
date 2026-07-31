const {
  chmodSync,
  existsSync,
  readFileSync
} = require("node:fs");

const {
  resolve
} = require("node:path");

const cliPath =
  resolve(
    __dirname,
    "../dist/cli/ega-v9.js"
  );

if (!existsSync(cliPath)) {
  throw new Error(
    `CLI build output not found: ${cliPath}`
  );
}

const cliSource =
  readFileSync(
    cliPath,
    "utf8"
  );

if (
  !cliSource.startsWith(
    "#!/usr/bin/env node"
  )
) {
  throw new Error(
    "CLI build output is missing the Node.js shebang."
  );
}

if (
  process.platform !== "win32"
) {
  chmodSync(
    cliPath,
    0o755
  );
}

console.log(
  `Prepared CLI executable: ${cliPath}`
);
