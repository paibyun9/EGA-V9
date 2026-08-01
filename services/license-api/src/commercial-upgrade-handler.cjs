"use strict";

const {
  CommercialUpgradeError
} = require(
  "./commercial-upgrade-service.cjs"
);

function extractBearerLicenseKey(
  request
) {
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
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_AUTH_REQUIRED",
      "A valid EGA V9 License Key is required.",
      401
    );
  }

  const licenseKey =
    authorization
      .slice(
        "Bearer ".length
      )
      .trim();

  if (!licenseKey) {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_AUTH_REQUIRED",
      "A valid EGA V9 License Key is required.",
      401
    );
  }

  return licenseKey;
}

function createCommercialUpgradeHandler(
  options
) {
  const {
    service
  } = options;

  if (
    !service ||
    typeof service
      .requestUpgrade !==
      "function" ||
    typeof service
      .getUpgradeStatus !==
      "function"
  ) {
    throw new CommercialUpgradeError(
      "EGA_COMMERCIAL_SERVICE_UNAVAILABLE",
      "Commercial Upgrade Service is unavailable.",
      503
    );
  }

  return {
    requestUpgrade(
      request
    ) {
      return service
        .requestUpgrade(
          extractBearerLicenseKey(
            request
          )
        );
    },

    getStatus(
      request
    ) {
      return service
        .getUpgradeStatus(
          extractBearerLicenseKey(
            request
          )
        );
    }
  };
}

module.exports = {
  createCommercialUpgradeHandler,
  extractBearerLicenseKey
};
