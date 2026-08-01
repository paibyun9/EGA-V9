"use strict";

const {
  randomUUID
} = require("node:crypto");

const {
  verifyLicenseKey,
  serializeLicenseForSigning
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

const {
  sign
} = require("node:crypto");

const LICENSE_KEY_PREFIX =
  "EGA9-LIC-V1";

class CommercialUpgradeError
  extends Error {
  constructor(
    code,
    message,
    statusCode = 400
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "CommercialUpgradeError";

    this.code =
      code;

    this.statusCode =
      statusCode;
  }
}

function encodeBase64Url(
  value
) {
  return Buffer
    .from(value)
    .toString("base64url");
}

function issueCommercialLicenseKey(
  commercialLicense,
  privateKey
) {
  const payload =
    serializeLicenseForSigning(
      commercialLicense
    );

  const signature =
    sign(
      null,
      Buffer.from(
        payload,
        "utf8"
      ),
      privateKey
    );

  return [
    LICENSE_KEY_PREFIX,
    encodeBase64Url(payload),
    encodeBase64Url(signature)
  ].join(".");
}

function requireDate(
  value,
  fieldName
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_DATE_INVALID",
      `${fieldName} is invalid.`
    );
  }

  return date;
}

function authenticateLicense(
  licenseKey,
  publicKey
) {
  if (
    typeof licenseKey !==
      "string" ||
    licenseKey.trim().length ===
      0
  ) {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_AUTH_REQUIRED",
      "A valid EGA V9 License Key is required.",
      401
    );
  }

  try {
    return verifyLicenseKey(
      licenseKey,
      publicKey
    );
  } catch {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_AUTH_INVALID",
      "EGA V9 License Key verification failed.",
      401
    );
  }
}

function createCommercialUpgradeService(
  options
) {
  const {
    registry,
    publicKey,
    privateKey,
    nowFactory =
      () => new Date()
  } = options;

  if (
    !registry ||
    typeof registry
      .findByLicenseId !==
      "function" ||
    typeof registry
      .updateRecord !==
      "function"
  ) {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_REGISTRY_UNAVAILABLE",
      "License Registry is unavailable.",
      503
    );
  }

  function requestUpgrade(
    licenseKey
  ) {
    const license =
      authenticateLicense(
        licenseKey,
        publicKey
      );

    const record =
      registry.findByLicenseId(
        license.licenseId
      );

    if (!record) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_LICENSE_NOT_FOUND",
        "License Registry record was not found.",
        404
      );
    }

    if (
      record.status ===
        "commercial" &&
      record.commercialLicenseId
    ) {
      return {
        created: false,
        requestId:
          record.commercialRequestId,
        status:
          "approved"
      };
    }

    if (
      record.commercialRequestStatus ===
        "pending"
    ) {
      return {
        created: false,
        requestId:
          record.commercialRequestId,
        status:
          "pending"
      };
    }

    if (
      record.commercialRequestStatus ===
        "approved"
    ) {
      return {
        created: false,
        requestId:
          record.commercialRequestId,
        status:
          "approved"
      };
    }

    const now =
      requireDate(
        nowFactory(),
        "current time"
      );

    const requestId =
      `commercial_request_${randomUUID()}`;

    registry.updateRecord(
      record.licenseId,
      {
        status:
          "commercial-requested",
        commercialRequestId:
          requestId,
        commercialRequestStatus:
          "pending",
        commercialRequestedAt:
          now.toISOString(),
        commercialReviewedAt:
          null,
        commercialRejectionReason:
          null
      },
      now
    );

    return {
      created: true,
      requestId,
      status:
        "pending"
    };
  }

  function getUpgradeStatus(
    licenseKey
  ) {
    const license =
      authenticateLicense(
        licenseKey,
        publicKey
      );

    const record =
      registry.findByLicenseId(
        license.licenseId
      );

    if (!record) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_LICENSE_NOT_FOUND",
        "License Registry record was not found.",
        404
      );
    }

    if (
      !record.commercialRequestId ||
      !record.commercialRequestStatus
    ) {
      return {
        requested: false,
        requestId: null,
        status: null,
        commercialLicenseKey:
          null
      };
    }

    if (
      record.commercialRequestStatus !==
        "approved"
    ) {
      return {
        requested: true,
        requestId:
          record.commercialRequestId,
        status:
          record.commercialRequestStatus,
        rejectionReason:
          record.commercialRejectionReason ??
          null,
        commercialLicenseKey:
          null
      };
    }

    if (
      !privateKey ||
      !record.commercialLicenseId ||
      !record.commercialIssuedAt
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_SIGNING_UNAVAILABLE",
        "Commercial License signing is unavailable.",
        503
      );
    }

    const commercialLicense = {
      schemaVersion: 1,
      licenseKind:
        "commercial",
      licenseId:
        record.commercialLicenseId,
      contactName:
        record.contactName,
      companyName:
        record.companyName,
      workEmail:
        record.workEmail,
      issuedAt:
        record.commercialIssuedAt,
      ...(record.commercialExpiresAt
        ? {
            expiresAt:
              record.commercialExpiresAt
          }
        : {})
    };

    return {
      requested: true,
      requestId:
        record.commercialRequestId,
      status:
        "approved",
      commercialLicense:
        commercialLicense,
      commercialLicenseKey:
        issueCommercialLicenseKey(
          commercialLicense,
          privateKey
        )
    };
  }

  function approveUpgrade(
    input
  ) {
    const {
      requestId,
      expiresAt = null
    } = input;

    if (
      typeof requestId !==
        "string" ||
      requestId.trim().length ===
        0
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_INVALID",
        "Commercial requestId is required."
      );
    }

    const record =
      registry
        .listRecords()
        .find(
          candidate =>
            candidate
              .commercialRequestId ===
            requestId
        );

    if (!record) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_NOT_FOUND",
        "Commercial License request was not found.",
        404
      );
    }

    if (
      record.commercialRequestStatus ===
        "approved"
    ) {
      return {
        approved: false,
        alreadyApproved: true,
        requestId:
          record.commercialRequestId,
        commercialLicenseId:
          record.commercialLicenseId
      };
    }

    if (
      record.commercialRequestStatus !==
        "pending"
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_STATE",
        "Only a pending Commercial request can be approved."
      );
    }

    const now =
      requireDate(
        nowFactory(),
        "current time"
      );

    let normalizedExpiresAt =
      null;

    if (expiresAt) {
      const expiration =
        requireDate(
          expiresAt,
          "expiresAt"
        );

      if (
        expiration.getTime() <=
        now.getTime()
      ) {
        throw new CommercialUpgradeError(
          "EGA_COMMERCIAL_DATE_INVALID",
          "Commercial expiresAt must be later than issuedAt."
        );
      }

      normalizedExpiresAt =
        expiration.toISOString();
    }

    const commercialLicenseId =
      `commercial_${randomUUID()}`;

    registry.updateRecord(
      record.licenseId,
      {
        status:
          "commercial",
        commercialRequestStatus:
          "approved",
        commercialReviewedAt:
          now.toISOString(),
        commercialRejectionReason:
          null,
        commercialLicenseId,
        commercialIssuedAt:
          now.toISOString(),
        commercialExpiresAt:
          normalizedExpiresAt,
        commercialActivatedAt:
          now.toISOString()
      },
      now
    );

    return {
      approved: true,
      alreadyApproved: false,
      requestId:
        record.commercialRequestId,
      commercialLicenseId,
      issuedAt:
        now.toISOString(),
      expiresAt:
        normalizedExpiresAt
    };
  }

  function rejectUpgrade(
    input
  ) {
    const {
      requestId,
      reason
    } = input;

    if (
      typeof requestId !==
        "string" ||
      requestId.trim().length ===
        0
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_INVALID",
        "Commercial requestId is required."
      );
    }

    if (
      typeof reason !==
        "string" ||
      reason.trim().length ===
        0
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_INVALID",
        "A rejection reason is required."
      );
    }

    const record =
      registry
        .listRecords()
        .find(
          candidate =>
            candidate
              .commercialRequestId ===
            requestId
        );

    if (!record) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_NOT_FOUND",
        "Commercial License request was not found.",
        404
      );
    }

    if (
      record.commercialRequestStatus !==
        "pending"
    ) {
      throw new CommercialUpgradeError(
        "EGA_COMMERCIAL_REQUEST_STATE",
        "Only a pending Commercial request can be rejected."
      );
    }

    const now =
      requireDate(
        nowFactory(),
        "current time"
      );

    registry.updateRecord(
      record.licenseId,
      {
        status:
          "active",
        commercialRequestStatus:
          "rejected",
        commercialReviewedAt:
          now.toISOString(),
        commercialRejectionReason:
          reason.trim()
      },
      now
    );

    return {
      rejected: true,
      requestId:
        record.commercialRequestId
    };
  }

  return {
    requestUpgrade,
    getUpgradeStatus,
    approveUpgrade,
    rejectUpgrade
  };
}

module.exports = {
  CommercialUpgradeError,
  createCommercialUpgradeService,
  issueCommercialLicenseKey
};
