"use strict";

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(
  __dirname,
  ".."
);

const distDirectory = path.join(
  packageRoot,
  "dist"
);

const commonJsEntry = path.join(
  distDirectory,
  "index.js"
);

const esmEntry = path.join(
  distDirectory,
  "index.mjs"
);

if (!fs.existsSync(commonJsEntry)) {
  console.error(
    `CommonJS build output is missing: ${commonJsEntry}`
  );
  process.exit(1);
}

const source = `"use strict compatibility wrapper";

import commonJsModule from "./index.js";

const {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} = commonJsModule;

export {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
};

/*
 * Preserve the historical Node.js ESM-to-CommonJS default-import
 * compatibility behavior.
 */
export default commonJsModule;
`;

fs.writeFileSync(
  esmEntry,
  source,
  "utf8"
);

console.log(
  `Generated ESM wrapper: ${esmEntry}`
);
