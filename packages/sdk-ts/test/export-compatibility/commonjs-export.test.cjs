"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const sdk = require(
  "../../dist/index.js"
);

const EXPECTED_EXPORTS = [
  "EGA",
  "contain",
  "ega",
  "provenance",
  "replay",
  "verifyExecution",
].sort();

test(
  "CommonJS exposes the frozen six public exports",
  () => {
    const observed =
      Object.keys(sdk).sort();

    assert.deepEqual(
      observed,
      EXPECTED_EXPORTS
    );

    for (
      const exportName
      of EXPECTED_EXPORTS
    ) {
      assert.notEqual(
        sdk[exportName],
        undefined,
        `${exportName} must be defined`
      );
    }
  }
);

test(
  "CommonJS public functions remain callable",
  () => {
    assert.equal(
      typeof sdk.EGA,
      "function"
    );

    assert.equal(
      typeof sdk.ega,
      "object"
    );

    assert.equal(
      typeof sdk.verifyExecution,
      "function"
    );

    assert.equal(
      typeof sdk.replay,
      "function"
    );

    assert.equal(
      typeof sdk.provenance,
      "function"
    );

    assert.equal(
      typeof sdk.contain,
      "function"
    );
  }
);
