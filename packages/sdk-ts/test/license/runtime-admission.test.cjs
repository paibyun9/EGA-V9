"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  generateKeyPairSync
} = require("node:crypto");

const {
  EGARuntimeAdmissionError,
  assertRuntimeLicenseAdmission,
  evaluateRuntimeAdmission
} = require(
  "../../dist/license/runtime-admission.js"
);

const {
  publicKey
} = generateKeyPairSync(
  "ed25519"
);

function evaluationLicense(
  overrides = {}
) {
  return {
    schemaVersion: 1,
    licenseKind:
      "evaluation",
    licenseId:
      "eval_runtime_001",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    workEmail:
      "test@example.com",
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z",
    ...overrides
  };
}

function commercialLicense(
  overrides = {}
) {
  return {
    schemaVersion: 1,
    licenseKind:
      "commercial",
    licenseId:
      "commercial_runtime_001",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    workEmail:
      "test@example.com",
    issuedAt:
      "2026-10-29T00:00:00.000Z",
    ...overrides
  };
}

function dependencies(
  overrides = {}
) {
  return {
    now:
      new Date(
        "2026-08-01T00:00:00.000Z"
      ),

    readLicenseKey:
      () =>
        "signed-license-key",

    loadPublicKey:
      () =>
        publicKey,

    verifyLicenseKey:
      () =>
        evaluationLicense(),

    ...overrides
  };
}

test(
  "automatically admits an active Evaluation License",
  () => {
    const admission =
      assertRuntimeLicenseAdmission(
        dependencies()
      );

    assert.equal(
      admission.admitted,
      true
    );

    assert.equal(
      admission.decision,
      "allow"
    );

    assert.equal(
      admission.reason,
      "evaluation-active"
    );

    assert.equal(
      admission.licenseKind,
      "evaluation"
    );

    assert.equal(
      admission.daysRemaining,
      90
    );
  }
);

test(
  "admits an Evaluation License on Day 89",
  () => {
    const admission =
      evaluateRuntimeAdmission(
        dependencies({
          now:
            new Date(
              "2026-10-29T00:00:00.000Z"
            )
        })
      );

    assert.equal(
      admission.admitted,
      true
    );

    assert.equal(
      admission.daysRemaining,
      1
    );
  }
);

test(
  "stops governed execution on Day 90",
  () => {
    assert.throws(
      () =>
        assertRuntimeLicenseAdmission(
          dependencies({
            now:
              new Date(
                "2026-10-30T00:00:00.000Z"
              )
          })
        ),
      error =>
        error instanceof
          EGARuntimeAdmissionError &&
        error.code ===
          "EGA_RUNTIME_LICENSE_EXPIRED" &&
        error.admission.admitted ===
          false &&
        error.admission.reason ===
          "evaluation-expired"
    );
  }
);

test(
  "continues execution with an active Commercial License",
  () => {
    const admission =
      assertRuntimeLicenseAdmission(
        dependencies({
          now:
            new Date(
              "2027-08-01T00:00:00.000Z"
            ),

          verifyLicenseKey:
            () =>
              commercialLicense()
        })
      );

    assert.equal(
      admission.admitted,
      true
    );

    assert.equal(
      admission.reason,
      "commercial-active"
    );

    assert.equal(
      admission.licenseKind,
      "commercial"
    );

    assert.equal(
      admission.daysRemaining,
      null
    );
  }
);

test(
  "stops execution with an expired Commercial License",
  () => {
    assert.throws(
      () =>
        assertRuntimeLicenseAdmission(
          dependencies({
            now:
              new Date(
                "2027-08-01T00:00:00.000Z"
              ),

            verifyLicenseKey:
              () =>
                commercialLicense({
                  expiresAt:
                    "2027-07-31T00:00:00.000Z"
                })
          })
        ),
      error =>
        error instanceof
          EGARuntimeAdmissionError &&
        error.code ===
          "EGA_RUNTIME_LICENSE_EXPIRED" &&
        error.admission.reason ===
          "commercial-expired"
    );
  }
);

test(
  "fails closed when no License Key is installed",
  () => {
    assert.throws(
      () =>
        assertRuntimeLicenseAdmission(
          dependencies({
            readLicenseKey:
              () => null
          })
        ),
      error =>
        error instanceof
          EGARuntimeAdmissionError &&
        error.code ===
          "EGA_RUNTIME_LICENSE_MISSING"
    );
  }
);

test(
  "fails closed when the Public Key is unavailable",
  () => {
    assert.throws(
      () =>
        assertRuntimeLicenseAdmission(
          dependencies({
            loadPublicKey:
              () => {
                throw new Error(
                  "Public Key unavailable"
                );
              }
          })
        ),
      error =>
        error instanceof
          EGARuntimeAdmissionError &&
        error.code ===
          "EGA_RUNTIME_PUBLIC_KEY_UNAVAILABLE"
    );
  }
);

test(
  "fails closed when License Key verification fails",
  () => {
    assert.throws(
      () =>
        assertRuntimeLicenseAdmission(
          dependencies({
            verifyLicenseKey:
              () => {
                throw new Error(
                  "Invalid signature"
                );
              }
          })
        ),
      error =>
        error instanceof
          EGARuntimeAdmissionError &&
        error.code ===
          "EGA_RUNTIME_LICENSE_VERIFICATION_FAILED" &&
        !String(error).includes(
          "executionPayload"
        )
    );
  }
);
