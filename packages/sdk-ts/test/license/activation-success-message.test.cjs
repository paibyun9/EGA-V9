"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  buildActivationSuccessMessage
} = require(
  "../../dist/cli/activation-success-message.js"
);

test(
  "activation success message confirms immediate use and shows resources",
  () => {
    const message =
      buildActivationSuccessMessage({
        contactName:
          "Test User",
        companyName:
          "Test Company",
        workEmail:
          "developer@example.com",
        issuedAt:
          "2026-08-01",
        expiresAt:
          "2026-10-30"
      });

    for (const required of [
      "✓ Evaluation License Activated",
      "Test User",
      "Test Company",
      "developer@example.com",
      "You can start using Runtime Governance immediately.",
      "https://github.com/paibyun9/EGA-V9/issues",
      "https://ega-v9.vercel.app/",
      "https://lcm3.com/"
    ]) {
      assert.equal(
        message.includes(required),
        true,
        `Missing expected text: ${required}`
      );
    }
  }
);
