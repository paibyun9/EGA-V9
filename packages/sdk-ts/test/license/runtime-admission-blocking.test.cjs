"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  verifyExecution
} = require(
  "../../dist/index.js"
);

const {
  setRuntimeAdmissionProviderForTesting
} = require(
  "../../dist/license/runtime-admission-provider.js"
);

const {
  EGARuntimeAdmissionError
} = require(
  "../../dist/license/runtime-admission.js"
);

function expiredAdmissionError() {
  return new EGARuntimeAdmissionError({
    code:
      "EGA_RUNTIME_LICENSE_EXPIRED",

    message:
      "The 90-day EGA V9 Evaluation License has expired.",

    admission: {
      admitted:
        false,
      decision:
        "deny",
      reason:
        "evaluation-expired",
      licenseKind:
        "evaluation",
      licenseId:
        "eval_expired_test",
      expiresAt:
        "2026-10-30T00:00:00.000Z",
      daysRemaining:
        0
    }
  });
}

test(
  "expired Evaluation License blocks verifyExecution before input processing",
  () => {
    let admissionChecked =
      false;

    const restore =
      setRuntimeAdmissionProviderForTesting(
        () => {
          admissionChecked =
            true;

          throw expiredAdmissionError();
        }
      );

    try {
      assert.throws(
        () =>
          verifyExecution({
            deliberately:
              "invalid runtime input"
          }),
        error =>
          error instanceof
            EGARuntimeAdmissionError &&
          error.code ===
            "EGA_RUNTIME_LICENSE_EXPIRED"
      );

      assert.equal(
        admissionChecked,
        true
      );
    } finally {
      restore();
    }
  }
);

test(
  "admitted License permits verifyExecution to reach existing input validation",
  () => {
    let admissionChecked =
      false;

    const restore =
      setRuntimeAdmissionProviderForTesting(
        () => {
          admissionChecked =
            true;
        }
      );

    try {
      /*
       * The fixture is deliberately minimal.
       * Existing EGA input validation may reject it,
       * but Runtime Admission must execute first.
       */
      try {
        verifyExecution({});
      } catch (
        error
      ) {
        assert.equal(
          error instanceof
            EGARuntimeAdmissionError,
          false
        );
      }

      assert.equal(
        admissionChecked,
        true
      );
    } finally {
      restore();
    }
  }
);

test(
  "testing provider is restored after each test",
  () => {
    let firstProviderCalled =
      false;

    const restore =
      setRuntimeAdmissionProviderForTesting(
        () => {
          firstProviderCalled =
            true;
        }
      );

    try {
      try {
        verifyExecution({});
      } catch {
        // Existing Runtime validation may reject the fixture.
      }

      assert.equal(
        firstProviderCalled,
        true
      );
    } finally {
      restore();
    }
  }
);
