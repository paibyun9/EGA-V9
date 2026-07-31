"use strict";

const {
  randomUUID
} = require("node:crypto");

const {
  issueEvaluationLicenseKey
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

const {
  LicenseRegistryError
} = require(
  "./license-registry.cjs"
);

const EVALUATION_DAYS = 90;
const DAY_MS =
  24 * 60 * 60 * 1000;

class EvaluationLicenseServiceError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(
      `[${code}] ${message}`
    );

    this.name =
      "EvaluationLicenseServiceError";

    this.code =
      code;
  }
}

function requireString(
  value,
  fieldName,
  maxLength
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_REQUEST_INVALID",
      `${fieldName} is required.`
    );
  }

  const normalized =
    value.trim();

  if (
    normalized.length >
    maxLength
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_REQUEST_INVALID",
      `${fieldName} exceeds the maximum length of ${maxLength}.`
    );
  }

  return normalized;
}

function validateWorkEmail(
  value
) {
  const workEmail =
    requireString(
      value,
      "Work Email",
      254
    ).toLowerCase();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailPattern.test(
      workEmail
    )
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_REQUEST_INVALID",
      "Work Email must be a valid email address."
    );
  }

  return workEmail;
}

function normalizeRegistrationInput(
  input
) {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_REQUEST_INVALID",
      "The request body must be a JSON object."
    );
  }

  return {
    contactName:
      requireString(
        input.contactName,
        "Contact Name",
        120
      ),
    companyName:
      requireString(
        input.companyName,
        "Company Name",
        200
      ),
    workEmail:
      validateWorkEmail(
        input.workEmail
      )
  };
}

function issueEvaluationLicense(
  args
) {
  const {
    input,
    privateKey,
    registry,
    now = new Date(),
    licenseIdFactory = () =>
      `eval_${randomUUID()}`
  } = args;

  if (
    !(now instanceof Date) ||
    Number.isNaN(
      now.getTime()
    )
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_SERVER_ERROR",
      "The server clock is invalid."
    );
  }

  if (!privateKey) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_SERVICE_UNAVAILABLE",
      "Evaluation License signing is unavailable."
    );
  }

  if (
    !registry ||
    typeof registry
      .createEvaluationRecord !==
      "function"
  ) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_SERVICE_UNAVAILABLE",
      "License Registry is unavailable."
    );
  }

  const registration =
    normalizeRegistrationInput(
      input
    );

  const existingRecord =
    registry.findByWorkEmail(
      registration.workEmail
    );

  if (existingRecord) {
    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_TRIAL_ALREADY_ISSUED",
      "A 90-day Evaluation License has already been issued for this Work Email."
    );
  }

  const issuedAt =
    new Date(now);

  const expiresAt =
    new Date(
      issuedAt.getTime() +
      EVALUATION_DAYS *
        DAY_MS
    );

  const license = {
    schemaVersion: 1,
    licenseKind:
      "evaluation",
    licenseId:
      licenseIdFactory(),
    contactName:
      registration.contactName,
    companyName:
      registration.companyName,
    workEmail:
      registration.workEmail,
    issuedAt:
      issuedAt.toISOString(),
    expiresAt:
      expiresAt.toISOString()
  };

  const evaluationLicenseKey =
    issueEvaluationLicenseKey(
      license,
      privateKey
    );

  try {
    registry
      .createEvaluationRecord({
        licenseId:
          license.licenseId,
        contactName:
          license.contactName,
        companyName:
          license.companyName,
        workEmail:
          license.workEmail,
        issuedAt:
          license.issuedAt,
        expiresAt:
          license.expiresAt,
        status:
          "active",
        createdAt:
          issuedAt
      });
  } catch (error) {
    if (
      error instanceof
        LicenseRegistryError &&
      error.code ===
        "EGA_LICENSE_TRIAL_ALREADY_ISSUED"
    ) {
      throw new EvaluationLicenseServiceError(
        "EGA_LICENSE_TRIAL_ALREADY_ISSUED",
        "A 90-day Evaluation License has already been issued for this Work Email."
      );
    }

    throw new EvaluationLicenseServiceError(
      "EGA_LICENSE_SERVICE_UNAVAILABLE",
      `Unable to persist the Evaluation License: ${
        error instanceof Error
          ? error.message
          : "unknown registry error"
      }`
    );
  }

  return {
    evaluationLicenseKey,
    license
  };
}

module.exports = {
  EVALUATION_DAYS,
  EvaluationLicenseServiceError,
  issueEvaluationLicense,
  normalizeRegistrationInput
};
