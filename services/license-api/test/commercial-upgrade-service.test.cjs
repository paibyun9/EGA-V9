"use strict";

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
  verifyLicenseKey
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

const {
  createFileLicenseRegistry
} = require(
  "../src/license-registry.cjs"
);

const {
  createCommercialUpgradeService
} = require(
  "../src/commercial-upgrade-service.cjs"
);

function createEnvironment() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-commercial-upgrade-"
      )
    );

  const {
    privateKey,
    publicKey
  } = generateKeyPairSync(
    "ed25519"
  );

  const registry =
    createFileLicenseRegistry({
      registryPath:
        join(
          directoryPath,
          "registry.json"
        )
    });

  registry.initialize();

  const evaluationLicense = {
    schemaVersion: 1,
    licenseKind:
      "evaluation",
    licenseId:
      "eval_commercial_001",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    workEmail:
      "test@example.com",
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z"
  };

  registry.createEvaluationRecord({
    ...evaluationLicense,
    status:
      "active",
    createdAt:
      new Date(
        evaluationLicense.issuedAt
      )
  });

  const evaluationLicenseKey =
    issueEvaluationLicenseKey(
      evaluationLicense,
      privateKey
    );

  const service =
    createCommercialUpgradeService({
      registry,
      privateKey,
      publicKey,
      nowFactory:
        () =>
          new Date(
            "2026-10-15T00:00:00.000Z"
          )
    });

  return {
    directoryPath,
    privateKey,
    publicKey,
    registry,
    service,
    evaluationLicenseKey
  };
}

function cleanup(
  directoryPath
) {
  rmSync(
    directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "creates one pending Commercial License request",
  () => {
    const environment =
      createEnvironment();

    try {
      const result =
        environment.service
          .requestUpgrade(
            environment
              .evaluationLicenseKey
          );

      assert.equal(
        result.created,
        true
      );

      assert.equal(
        result.status,
        "pending"
      );

      const duplicate =
        environment.service
          .requestUpgrade(
            environment
              .evaluationLicenseKey
          );

      assert.equal(
        duplicate.created,
        false
      );

      assert.equal(
        duplicate.requestId,
        result.requestId
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);

test(
  "approves a pending request and updates Registry status",
  () => {
    const environment =
      createEnvironment();

    try {
      const request =
        environment.service
          .requestUpgrade(
            environment
              .evaluationLicenseKey
          );

      const approval =
        environment.service
          .approveUpgrade({
            requestId:
              request.requestId
          });

      assert.equal(
        approval.approved,
        true
      );

      const record =
        environment.registry
          .findByLicenseId(
            "eval_commercial_001"
          );

      assert.equal(
        record.status,
        "commercial"
      );

      assert.equal(
        record
          .commercialRequestStatus,
        "approved"
      );

      assert.equal(
        typeof record
          .commercialLicenseId,
        "string"
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);

test(
  "returns a signed Commercial License Key after approval",
  () => {
    const environment =
      createEnvironment();

    try {
      const request =
        environment.service
          .requestUpgrade(
            environment
              .evaluationLicenseKey
          );

      environment.service
        .approveUpgrade({
          requestId:
            request.requestId
        });

      const status =
        environment.service
          .getUpgradeStatus(
            environment
              .evaluationLicenseKey
          );

      assert.equal(
        status.status,
        "approved"
      );

      const commercialLicense =
        verifyLicenseKey(
          status
            .commercialLicenseKey,
          environment.publicKey
        );

      assert.equal(
        commercialLicense
          .licenseKind,
        "commercial"
      );

      assert.equal(
        commercialLicense
          .companyName,
        "Test Company"
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);

test(
  "does not store the signed Commercial License Key in Registry",
  () => {
    const environment =
      createEnvironment();

    try {
      const request =
        environment.service
          .requestUpgrade(
            environment
              .evaluationLicenseKey
          );

      environment.service
        .approveUpgrade({
          requestId:
            request.requestId
        });

      environment.service
        .getUpgradeStatus(
          environment
            .evaluationLicenseKey
        );

      const serialized =
        JSON.stringify(
          environment.registry
            .readRegistry()
        );

      assert.equal(
        serialized.includes(
          "EGA9-LIC-V1"
        ),
        false
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);
