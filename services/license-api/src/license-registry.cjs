"use strict";

const {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} = require("node:fs");

const {
  dirname,
  resolve
} = require("node:path");

const {
  randomUUID
} = require("node:crypto");

const REGISTRY_SCHEMA_VERSION = 1;

class LicenseRegistryError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);

    this.name = "LicenseRegistryError";
    this.code = code;
  }
}

function createEmptyRegistry() {
  return {
    schemaVersion:
      REGISTRY_SCHEMA_VERSION,
    records: []
  };
}

function normalizeWorkEmail(
  workEmail
) {
  if (
    typeof workEmail !== "string" ||
    workEmail.trim().length === 0
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_RECORD",
      "Work Email is required."
    );
  }

  return workEmail
    .trim()
    .toLowerCase();
}

function parseIsoDate(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    Number.isNaN(
      new Date(value).getTime()
    )
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_RECORD",
      `${fieldName} must be a valid ISO-8601 date string.`
    );
  }

  return value;
}

function validateRecord(
  record
) {
  if (
    typeof record !== "object" ||
    record === null ||
    Array.isArray(record)
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_RECORD",
      "License Registry record must be an object."
    );
  }

  const requiredStrings = [
    "licenseId",
    "contactName",
    "companyName",
    "workEmail",
    "issuedAt",
    "expiresAt",
    "createdAt",
    "updatedAt"
  ];

  for (
    const field of requiredStrings
  ) {
    if (
      typeof record[field] !==
        "string" ||
      record[field].trim().length ===
        0
    ) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_RECORD",
        `${field} is required.`
      );
    }
  }

  const allowedStatuses =
    new Set([
      "active",
      "expiring",
      "expired",
      "commercial-requested",
      "commercial",
      "closed"
    ]);

  if (
    !allowedStatuses.has(
      record.status
    )
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_RECORD",
      "License Registry status is invalid."
    );
  }

  const issuedAt =
    parseIsoDate(
      record.issuedAt,
      "issuedAt"
    );

  const expiresAt =
    parseIsoDate(
      record.expiresAt,
      "expiresAt"
    );

  parseIsoDate(
    record.createdAt,
    "createdAt"
  );

  parseIsoDate(
    record.updatedAt,
    "updatedAt"
  );

  if (
    new Date(expiresAt).getTime() <=
    new Date(issuedAt).getTime()
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_RECORD",
      "expiresAt must be later than issuedAt."
    );
  }

  return {
    ...record,
    contactName:
      record.contactName.trim(),
    companyName:
      record.companyName.trim(),
    workEmail:
      record.workEmail
        .trim()
        .toLowerCase(),
    normalizedWorkEmail:
      normalizeWorkEmail(
        record.workEmail
      )
  };
}

function validateRegistryData(
  value
) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.schemaVersion !==
      REGISTRY_SCHEMA_VERSION ||
    !Array.isArray(value.records)
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_CORRUPT",
      "License Registry has an unsupported or corrupt structure."
    );
  }

  const normalizedRecords =
    value.records.map(
      validateRecord
    );

  const licenseIds =
    new Set();

  const trialEmails =
    new Set();

  for (
    const record of
    normalizedRecords
  ) {
    if (
      licenseIds.has(
        record.licenseId
      )
    ) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_CORRUPT",
        `Duplicate licenseId found: ${record.licenseId}`
      );
    }

    licenseIds.add(
      record.licenseId
    );

    if (
      trialEmails.has(
        record.normalizedWorkEmail
      )
    ) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_CORRUPT",
        `Duplicate Evaluation License identity found: ${record.normalizedWorkEmail}`
      );
    }

    trialEmails.add(
      record.normalizedWorkEmail
    );
  }

  return {
    schemaVersion:
      REGISTRY_SCHEMA_VERSION,
    records:
      normalizedRecords
  };
}

function assertSafeRegistryFile(
  registryPath
) {
  const fileStatus =
    lstatSync(
      registryPath
    );

  if (
    fileStatus.isSymbolicLink() ||
    !fileStatus.isFile()
  ) {
    throw new LicenseRegistryError(
      "EGA_LICENSE_REGISTRY_PATH",
      "License Registry path must be a regular file and must not be a symbolic link."
    );
  }
}

function createFileLicenseRegistry(
  options = {}
) {
  const registryPath =
    resolve(
      options.registryPath ??
      process.env
        .EGA_V9_LICENSE_REGISTRY_PATH ??
      "./data/license-registry.json"
    );

  function initialize() {
    const directoryPath =
      dirname(
        registryPath
      );

    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    if (
      process.platform !==
        "win32"
    ) {
      chmodSync(
        directoryPath,
        0o700
      );
    }

    if (
      !existsSync(
        registryPath
      )
    ) {
      writeRegistry(
        createEmptyRegistry()
      );
    }

    return registryPath;
  }

  function readRegistry() {
    if (
      !existsSync(
        registryPath
      )
    ) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_UNAVAILABLE",
        "License Registry does not exist."
      );
    }

    assertSafeRegistryFile(
      registryPath
    );

    let parsed;

    try {
      parsed =
        JSON.parse(
          readFileSync(
            registryPath,
            "utf8"
          )
        );
    } catch {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_CORRUPT",
        "License Registry contains invalid JSON."
      );
    }

    return validateRegistryData(
      parsed
    );
  }

  function writeRegistry(
    registry
  ) {
    const validated =
      validateRegistryData(
        registry
      );

    const directoryPath =
      dirname(
        registryPath
      );

    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    const temporaryPath =
      `${registryPath}.tmp-${process.pid}-${randomUUID()}`;

    try {
      writeFileSync(
        temporaryPath,
        `${JSON.stringify(
          validated,
          null,
          2
        )}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx"
        }
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          temporaryPath,
          0o600
        );
      }

      renameSync(
        temporaryPath,
        registryPath
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          registryPath,
          0o600
        );
      }
    } finally {
      if (
        existsSync(
          temporaryPath
        )
      ) {
        rmSync(
          temporaryPath,
          {
            force: true
          }
        );
      }
    }
  }

  function findByWorkEmail(
    workEmail
  ) {
    const normalizedEmail =
      normalizeWorkEmail(
        workEmail
      );

    return (
      readRegistry()
        .records
        .find(
          record =>
            record
              .normalizedWorkEmail ===
            normalizedEmail
        ) ??
      null
    );
  }

  function findByLicenseId(
    licenseId
  ) {
    return (
      readRegistry()
        .records
        .find(
          record =>
            record.licenseId ===
            licenseId
        ) ??
      null
    );
  }

  function createEvaluationRecord(
    input
  ) {
    const existing =
      findByWorkEmail(
        input.workEmail
      );

    if (existing) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_TRIAL_ALREADY_ISSUED",
        "A 90-day Evaluation License has already been issued for this Work Email."
      );
    }

    const nowIso =
      (
        input.createdAt
          ? new Date(
              input.createdAt
            )
          : new Date()
      ).toISOString();

    const record =
      validateRecord({
        licenseId:
          input.licenseId,
        contactName:
          input.contactName,
        companyName:
          input.companyName,
        workEmail:
          input.workEmail,
        normalizedWorkEmail:
          normalizeWorkEmail(
            input.workEmail
          ),
        issuedAt:
          input.issuedAt,
        expiresAt:
          input.expiresAt,
        status:
          input.status ??
          "active",
        day60ReminderQueuedAt:
          null,
        day60ReminderSentAt:
          null,
        day83WarningQueuedAt:
          null,
        day83WarningSentAt:
          null,
        expirationQueuedAt:
          null,
        expirationSentAt:
          null,
        commercialRequestedAt:
          null,
        commercialActivatedAt:
          null,
        createdAt:
          nowIso,
        updatedAt:
          nowIso
      });

    const registry =
      readRegistry();

    registry.records.push(
      record
    );

    writeRegistry(
      registry
    );

    return record;
  }

  function listRecords() {
    return readRegistry()
      .records
      .map(
        record => ({
          ...record
        })
      );
  }

  function updateRecord(
    licenseId,
    changes,
    updatedAt =
      new Date()
  ) {
    const registry =
      readRegistry();

    const recordIndex =
      registry.records.findIndex(
        record =>
          record.licenseId ===
          licenseId
      );

    if (
      recordIndex === -1
    ) {
      throw new LicenseRegistryError(
        "EGA_LICENSE_REGISTRY_NOT_FOUND",
        `License record not found: ${licenseId}`
      );
    }

    const protectedFields =
      new Set([
        "licenseId",
        "workEmail",
        "normalizedWorkEmail",
        "issuedAt",
        "expiresAt",
        "createdAt"
      ]);

    for (
      const field of
      Object.keys(changes)
    ) {
      if (
        protectedFields.has(
          field
        )
      ) {
        throw new LicenseRegistryError(
          "EGA_LICENSE_REGISTRY_RECORD",
          `${field} cannot be modified.`
        );
      }
    }

    const nextRecord =
      validateRecord({
        ...registry.records[
          recordIndex
        ],
        ...changes,
        updatedAt:
          updatedAt.toISOString()
      });

    registry.records[
      recordIndex
    ] = nextRecord;

    writeRegistry(
      registry
    );

    return nextRecord;
  }

  return {
    registryPath,
    initialize,
    readRegistry,
    findByWorkEmail,
    findByLicenseId,
    createEvaluationRecord,
    listRecords,
    updateRecord
  };
}

module.exports = {
  REGISTRY_SCHEMA_VERSION,
  LicenseRegistryError,
  createFileLicenseRegistry,
  normalizeWorkEmail
};
