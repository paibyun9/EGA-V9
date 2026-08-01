"use strict";

const {
  createPublicKey
} = require("node:crypto");

const {
  verifyEvaluationLicenseKey
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

class UsageEventHandlerError
  extends Error {
  constructor(
    code,
    message,
    statusCode
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "UsageEventHandlerError";

    this.code = code;
    this.statusCode =
      statusCode;
  }
}

function extractBearerKey(request) {
  const authorization =
    String(
      request.headers
        .authorization ?? ""
    );

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    throw new UsageEventHandlerError(
      "EGA_USAGE_AUTH_REQUIRED",
      "A valid Evaluation License Key is required.",
      401
    );
  }

  const key =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!key) {
    throw new UsageEventHandlerError(
      "EGA_USAGE_AUTH_REQUIRED",
      "A valid Evaluation License Key is required.",
      401
    );
  }

  return key;
}

function createUsageEventHandler(options) {
  const {
    registry,
    usageMeter,
    privateKey,
    nowFactory =
      () => new Date()
  } = options;

  if (
    !registry ||
    typeof registry
      .findByLicenseId !==
      "function"
  ) {
    throw new UsageEventHandlerError(
      "EGA_USAGE_SERVICE_UNAVAILABLE",
      "License Registry is unavailable.",
      503
    );
  }

  if (
    !usageMeter ||
    typeof usageMeter
      .recordUsageEvent !==
      "function"
  ) {
    throw new UsageEventHandlerError(
      "EGA_USAGE_SERVICE_UNAVAILABLE",
      "Company Usage Meter is unavailable.",
      503
    );
  }

  if (!privateKey) {
    throw new UsageEventHandlerError(
      "EGA_USAGE_SERVICE_UNAVAILABLE",
      "License verification key is unavailable.",
      503
    );
  }

  const publicKey =
    createPublicKey(privateKey);

  return {
    record(request, body) {
      const evaluationLicenseKey =
        extractBearerKey(request);

      let license;

      try {
        license =
          verifyEvaluationLicenseKey(
            evaluationLicenseKey,
            publicKey
          );
      } catch {
        throw new UsageEventHandlerError(
          "EGA_USAGE_AUTH_INVALID",
          "Evaluation License Key verification failed.",
          401
        );
      }

      const registryRecord =
        registry.findByLicenseId(
          license.licenseId
        );

      if (!registryRecord) {
        throw new UsageEventHandlerError(
          "EGA_USAGE_LICENSE_NOT_FOUND",
          "License Registry record was not found.",
          404
        );
      }

      const now =
        nowFactory();

      if (
        new Date(
          registryRecord.expiresAt
        ).getTime() <=
        now.getTime()
      ) {
        throw new UsageEventHandlerError(
          "EGA_USAGE_LICENSE_EXPIRED",
          "The Evaluation License has expired.",
          403
        );
      }

      return usageMeter
        .recordUsageEvent({
          licenseId:
            registryRecord.licenseId,

          companyName:
            registryRecord.companyName,

          event:
            body,

          receivedAt:
            now
        });
    }
  };
}

module.exports = {
  UsageEventHandlerError,
  createUsageEventHandler,
  extractBearerKey
};
