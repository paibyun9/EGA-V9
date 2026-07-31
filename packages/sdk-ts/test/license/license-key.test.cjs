const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateKeyPairSync
} = require("node:crypto");

const {
  EGALicenseKeyError,
  issueEvaluationLicenseKey,
  verifyEvaluationLicenseKey
} = require("../../dist/license/license-key.js");

function createKeyPair() {
  return generateKeyPairSync(
    "ed25519"
  );
}

function createEvaluationLicense() {
  return {
    schemaVersion: 1,
    licenseKind: "evaluation",
    licenseId: "eval_test_001",
    contactName: "Test User",
    companyName: "Test Company",
    workEmail: "test@example.com",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-10-30T00:00:00.000Z"
  };
}

test(
  "issues and verifies a valid Evaluation License Key",
  () => {
    const {
      privateKey,
      publicKey
    } = createKeyPair();

    const license =
      createEvaluationLicense();

    const key =
      issueEvaluationLicenseKey(
        license,
        privateKey
      );

    assert.match(
      key,
      /^EGA9-LIC-V1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
    );

    const verified =
      verifyEvaluationLicenseKey(
        key,
        publicKey
      );

    assert.deepEqual(
      verified,
      license
    );
  }
);

test(
  "rejects a payload modified after signing",
  () => {
    const {
      privateKey,
      publicKey
    } = createKeyPair();

    const key =
      issueEvaluationLicenseKey(
        createEvaluationLicense(),
        privateKey
      );

    const parts =
      key.split(".");

    const payload =
      JSON.parse(
        Buffer
          .from(
            parts[1],
            "base64url"
          )
          .toString("utf8")
      );

    payload.companyName =
      "Tampered Company";

    parts[1] =
      Buffer
        .from(
          JSON.stringify(payload)
        )
        .toString("base64url");

    const tamperedKey =
      parts.join(".");

    assert.throws(
      () =>
        verifyEvaluationLicenseKey(
          tamperedKey,
          publicKey
        ),
      (error) =>
        error instanceof EGALicenseKeyError &&
        error.code ===
          "EGA_LICENSE_KEY_SIGNATURE"
    );
  }
);

test(
  "rejects a key signed by an unknown private key",
  () => {
    const issuer =
      createKeyPair();

    const unknownIssuer =
      createKeyPair();

    const key =
      issueEvaluationLicenseKey(
        createEvaluationLicense(),
        issuer.privateKey
      );

    assert.throws(
      () =>
        verifyEvaluationLicenseKey(
          key,
          unknownIssuer.publicKey
        ),
      (error) =>
        error instanceof EGALicenseKeyError &&
        error.code ===
          "EGA_LICENSE_KEY_SIGNATURE"
    );
  }
);

test(
  "rejects an unsupported key format",
  () => {
    const {
      publicKey
    } = createKeyPair();

    assert.throws(
      () =>
        verifyEvaluationLicenseKey(
          "INVALID-LICENSE-KEY",
          publicKey
        ),
      (error) =>
        error instanceof EGALicenseKeyError &&
        error.code ===
          "EGA_LICENSE_KEY_FORMAT"
    );
  }
);

test(
  "rejects an invalid work email before issuing",
  () => {
    const {
      privateKey
    } = createKeyPair();

    assert.throws(
      () =>
        issueEvaluationLicenseKey(
          {
            ...createEvaluationLicense(),
            workEmail: "invalid-email"
          },
          privateKey
        ),
      (error) =>
        error instanceof EGALicenseKeyError &&
        error.code ===
          "EGA_LICENSE_KEY_PAYLOAD"
    );
  }
);

test(
  "rejects an invalid Evaluation License date range",
  () => {
    const {
      privateKey
    } = createKeyPair();

    assert.throws(
      () =>
        issueEvaluationLicenseKey(
          {
            ...createEvaluationLicense(),
            expiresAt:
              "2026-08-01T00:00:00.000Z"
          },
          privateKey
        ),
      (error) =>
        error instanceof EGALicenseKeyError &&
        error.code ===
          "EGA_LICENSE_KEY_PAYLOAD"
    );
  }
);
