# EGA V9 Executable Examples

These examples verify the public EGA V9 SDK contract in CommonJS, ESM, and TypeScript environments.

## Public API used

- `EGA`
- `ega`
- `verifyExecution`
- `replay`
- `provenance`
- `contain`

## Install

```bash
npm install ega-v9
CommonJS
node commonjs/basic.cjs

The example uses:

const {
  EGA,
  ega,
  verifyExecution,
  replay,
  provenance,
  contain,
} = require("ega-v9");
ESM
node esm/basic.mjs

The example uses native named imports:

import {
  EGA,
  ega,
  verifyExecution,
  replay,
  provenance,
  contain,
} from "ega-v9";
TypeScript

Compile:

npx tsc \
  --project typescript/tsconfig.json

Run:

node typescript/dist/basic.mjs
Repository verification

From the repository root:

npm run v1.0.1:examples

The repository gate packs the SDK, installs the generated tarball into an isolated consumer directory, and runs all three examples against the installed package.
