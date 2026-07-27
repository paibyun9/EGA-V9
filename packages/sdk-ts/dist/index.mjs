"use strict compatibility wrapper";

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
