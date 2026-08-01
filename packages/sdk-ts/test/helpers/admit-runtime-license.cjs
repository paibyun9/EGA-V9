"use strict";

const {
  setRuntimeAdmissionProviderForTesting
} = require(
  "../../dist/license/runtime-admission-provider.js"
);

setRuntimeAdmissionProviderForTesting(
  () => {}
);
