const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  generateKeyPairSync
} = require("node:crypto");

const {
  mkdtempSync,
  rmSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  issueEvaluationLicenseKey,
  verifyEvaluationLicenseKey
} = require(
  "../../dist/license/license-key.js"
);

const {
  readEvaluationLicenseKey,
  saveEvaluationLicenseKey
} = require(
  "../../dist/license/license-store.js"
);

const {
  EGARegisterCommandError,
  runRegisterCommand
} = require(
  "../../dist/cli/register-command.js"
);

function createTemporaryDirectory() {
  return mkdtempSync(
    join(
      tmpdir(),
      "ega-v9-register-"
    )
  );
}

function createEvaluationLicense(
  input
) {
  return {
    schemaVersion: 1,
    licenseKind: "evaluation",
    licenseId: "eval_cli_test_001",
    contactName: input.contactName,
    companyName: input.companyName,
    workEmail: input.workEmail,
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z"
  };
}

test(
  "register command collects information, verifies the key, and stores it",
  async () => {
    const directoryPath =
      createTemporaryDirectory();

    const {
      privateKey,
      publicKey
    } = generateKeyPairSync(
      "ed25519"
    );

    const answers = [
      "Test User",
      "Test Company",
      "test@example.com"
    ];

    const messages = [];

    try {
      const result =
        await runRegisterCommand({
          ask: async () =>
            answers.shift(),

          issueEvaluationLicense:
            async input => ({
              evaluationLicenseKey:
                issueEvaluationLicenseKey(
                  createEvaluationLicense(
                    input
                  ),
                  privateKey
                )
            }),

          verifyEvaluationLicenseKey:
            key =>
              verifyEvaluationLicenseKey(
                key,
                publicKey
              ),

          saveEvaluationLicenseKey:
            (
              key,
              options
            ) =>
              saveEvaluationLicenseKey(
                key,
                {
                  baseDirectory:
                    directoryPath,
                  overwrite:
                    options?.overwrite
                }
              ),

          write: message =>
            messages.push(message)
        });

      assert.equal(
        result.license.contactName,
        "Test User"
      );

      assert.equal(
        result.license.companyName,
        "Test Company"
      );

      assert.equal(
        result.license.workEmail,
        "test@example.com"
      );

      assert.equal(
        typeof readEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        "string"
      );

      assert.equal(
        messages.includes(
          "✓ Evaluation License Activated"
        ),
        true
      );

      assert.equal(
        messages.includes(
          "Happy Building."
        ),
        true
      );
    } finally {
      rmSync(
        directoryPath,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  "register command rejects an invalid work email before calling the service",
  async () => {
    const answers = [
      "Test User",
      "Test Company",
      "invalid-email"
    ];

    let serviceCalled =
      false;

    await assert.rejects(
      () =>
        runRegisterCommand({
          ask: async () =>
            answers.shift(),

          issueEvaluationLicense:
            async () => {
              serviceCalled = true;

              return {
                evaluationLicenseKey:
                  "unused"
              };
            },

          verifyEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          saveEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          write: () => {}
        }),
      error =>
        error instanceof
          EGARegisterCommandError &&
        error.code ===
          "EGA_REGISTER_INPUT"
    );

    assert.equal(
      serviceCalled,
      false
    );
  }
);

test(
  "register command reports License Service failures",
  async () => {
    const answers = [
      "Test User",
      "Test Company",
      "test@example.com"
    ];

    await assert.rejects(
      () =>
        runRegisterCommand({
          ask: async () =>
            answers.shift(),

          issueEvaluationLicense:
            async () => {
              throw new Error(
                "service unavailable"
              );
            },

          verifyEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          saveEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          write: () => {}
        }),
      error =>
        error instanceof
          EGARegisterCommandError &&
        error.code ===
          "EGA_REGISTER_SERVICE"
    );
  }
);

test(
  "register command rejects an empty License Service response",
  async () => {
    const answers = [
      "Test User",
      "Test Company",
      "test@example.com"
    ];

    await assert.rejects(
      () =>
        runRegisterCommand({
          ask: async () =>
            answers.shift(),

          issueEvaluationLicense:
            async () => ({
              evaluationLicenseKey: ""
            }),

          verifyEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          saveEvaluationLicenseKey:
            () => {
              throw new Error(
                "must not be called"
              );
            },

          write: () => {}
        }),
      error =>
        error instanceof
          EGARegisterCommandError &&
        error.code ===
          "EGA_REGISTER_RESPONSE"
    );
  }
);
