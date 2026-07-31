"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  LicenseRegistryError,
  createFileLicenseRegistry
} = require(
  "../src/license-registry.cjs"
);

function createTestRegistry() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-registry-"
      )
    );

  const registryPath =
    join(
      directoryPath,
      "license-registry.json"
    );

  const registry =
    createFileLicenseRegistry({
      registryPath
    });

  registry.initialize();

  return {
    directoryPath,
    registryPath,
    registry
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

function createRecordInput(
  overrides = {}
) {
  return {
    licenseId:
      "eval_registry_001",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    workEmail:
      "Test@Example.com",
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z",
    status:
      "active",
    createdAt:
      new Date(
        "2026-08-01T00:00:00.000Z"
      ),
    ...overrides
  };
}

test(
  "initializes an empty persistent registry",
  () => {
    const {
      directoryPath,
      registryPath,
      registry
    } = createTestRegistry();

    try {
      assert.equal(
        existsSync(
          registryPath
        ),
        true
      );

      assert.deepEqual(
        registry.listRecords(),
        []
      );

      const parsed =
        JSON.parse(
          readFileSync(
            registryPath,
            "utf8"
          )
        );

      assert.equal(
        parsed.schemaVersion,
        1
      );

      if (
        process.platform !==
          "win32"
      ) {
        assert.equal(
          statSync(
            registryPath
          ).mode & 0o777,
          0o600
        );
      }
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "persists and reloads an Evaluation License record",
  () => {
    const {
      directoryPath,
      registryPath,
      registry
    } = createTestRegistry();

    try {
      const created =
        registry
          .createEvaluationRecord(
            createRecordInput()
          );

      assert.equal(
        created.workEmail,
        "test@example.com"
      );

      const reloaded =
        createFileLicenseRegistry({
          registryPath
        });

      assert.equal(
        reloaded
          .findByWorkEmail(
            "TEST@example.com"
          )
          .licenseId,
        "eval_registry_001"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "prevents a second Evaluation License for the same normalized Work Email",
  () => {
    const {
      directoryPath,
      registry
    } = createTestRegistry();

    try {
      registry
        .createEvaluationRecord(
          createRecordInput()
        );

      assert.throws(
        () =>
          registry
            .createEvaluationRecord(
              createRecordInput({
                licenseId:
                  "eval_registry_002",
                workEmail:
                  "test@example.com"
              })
            ),
        error =>
          error instanceof
            LicenseRegistryError &&
          error.code ===
            "EGA_LICENSE_TRIAL_ALREADY_ISSUED"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "updates operational status without changing protected identity fields",
  () => {
    const {
      directoryPath,
      registry
    } = createTestRegistry();

    try {
      registry
        .createEvaluationRecord(
          createRecordInput()
        );

      const updated =
        registry.updateRecord(
          "eval_registry_001",
          {
            status:
              "commercial-requested",
            commercialRequestedAt:
              "2026-09-30T00:00:00.000Z"
          },
          new Date(
            "2026-09-30T00:00:00.000Z"
          )
        );

      assert.equal(
        updated.status,
        "commercial-requested"
      );

      assert.equal(
        updated.commercialRequestedAt,
        "2026-09-30T00:00:00.000Z"
      );

      assert.throws(
        () =>
          registry.updateRecord(
            "eval_registry_001",
            {
              workEmail:
                "changed@example.com"
            }
          ),
        error =>
          error instanceof
            LicenseRegistryError &&
          error.code ===
            "EGA_LICENSE_REGISTRY_RECORD"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "fails closed when the registry JSON is corrupt",
  () => {
    const {
      directoryPath,
      registryPath,
      registry
    } = createTestRegistry();

    try {
      writeFileSync(
        registryPath,
        "{invalid json",
        "utf8"
      );

      assert.throws(
        () =>
          registry.listRecords(),
        error =>
          error instanceof
            LicenseRegistryError &&
          error.code ===
            "EGA_LICENSE_REGISTRY_CORRUPT"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);
