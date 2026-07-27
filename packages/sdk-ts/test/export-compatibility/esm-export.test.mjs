import test from "node:test";
import assert from "node:assert/strict";

import defaultExport, {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
} from "../../dist/index.mjs";

const namedExports = {
  EGA,
  contain,
  ega,
  provenance,
  replay,
  verifyExecution,
};

const EXPECTED_EXPORTS = [
  "EGA",
  "contain",
  "ega",
  "provenance",
  "replay",
  "verifyExecution",
].sort();

test(
  "ESM exposes all frozen named exports",
  () => {
    assert.deepEqual(
      Object.keys(namedExports).sort(),
      EXPECTED_EXPORTS
    );

    for (
      const exportName
      of EXPECTED_EXPORTS
    ) {
      assert.notEqual(
        namedExports[exportName],
        undefined,
        `${exportName} must be defined`
      );
    }
  }
);

test(
  "ESM named exports have expected runtime types",
  () => {
    assert.equal(
      typeof EGA,
      "function"
    );

    assert.equal(
      typeof ega,
      "object"
    );

    assert.equal(
      typeof verifyExecution,
      "function"
    );

    assert.equal(
      typeof replay,
      "function"
    );

    assert.equal(
      typeof provenance,
      "function"
    );

    assert.equal(
      typeof contain,
      "function"
    );
  }
);

test(
  "ESM default import preserves legacy CommonJS interoperability",
  () => {
    assert.ok(defaultExport);

    assert.deepEqual(
      Object.keys(defaultExport).sort(),
      EXPECTED_EXPORTS
    );

    assert.equal(
      defaultExport.EGA,
      EGA
    );

    assert.equal(
      defaultExport.ega,
      ega
    );
  }
);
