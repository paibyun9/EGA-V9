import {
  verifyLicenseKey
} from "../license/license-key";

import {
  readEvaluationLicenseKey,
  saveEvaluationLicenseKey
} from "../license/license-store";

import {
  loadEvaluationLicensePublicKey
} from "../license/public-key";

import {
  createCommercialApiClient
} from "./commercial-api-client";

export type EGAUpgradeCommandOptions = {
  apiBaseUrl?: string;
  writeLine?:
    (value: string) => void;
};

export async function runUpgradeCommand(
  options:
    EGAUpgradeCommandOptions = {}
): Promise<number> {
  const writeLine =
    options.writeLine ??
    console.log;

  const installedLicenseKey =
    readEvaluationLicenseKey();

  if (!installedLicenseKey) {
    writeLine(
      "No EGA V9 License Key is installed."
    );

    writeLine(
      "Run `npx ega-v9 register` first."
    );

    return 1;
  }

  const apiBaseUrl =
    options.apiBaseUrl ??
    process.env
      .EGA_V9_LICENSE_API_URL;

  if (!apiBaseUrl) {
    writeLine(
      "EGA V9 License Service URL is not configured."
    );

    return 1;
  }

  const client =
    createCommercialApiClient({
      apiBaseUrl
    });

  try {
    const currentStatus =
      await client.getStatus(
        installedLicenseKey
      );

    if (
      currentStatus.status ===
        "approved" &&
      currentStatus
        .commercialLicenseKey
    ) {
      const commercialLicense =
        verifyLicenseKey(
          currentStatus
            .commercialLicenseKey,
          loadEvaluationLicensePublicKey()
        );

      if (
        commercialLicense
          .licenseKind !==
        "commercial"
      ) {
        throw new Error(
          "The returned License is not Commercial."
        );
      }

      saveEvaluationLicenseKey(
        currentStatus
          .commercialLicenseKey,
        {
          overwrite: true
        }
      );

      writeLine("");
      writeLine(
        "✓ Commercial License Activated"
      );
      writeLine("");
      writeLine(
        `Company: ${commercialLicense.companyName}`
      );
      writeLine(
        `License ID: ${commercialLicense.licenseId}`
      );
      writeLine(
        `Issued: ${commercialLicense.issuedAt.slice(0, 10)}`
      );
      writeLine(
        commercialLicense.expiresAt
          ? `Expires: ${commercialLicense.expiresAt.slice(0, 10)}`
          : "Expires: No fixed expiration"
      );

      return 0;
    }

    if (
      currentStatus.status ===
        "pending"
    ) {
      writeLine("");
      writeLine(
        "Commercial License request is under review."
      );
      writeLine(
        `Request ID: ${currentStatus.requestId}`
      );
      writeLine("");
      writeLine(
        "Run `npx ega-v9 upgrade` again after LCM confirms your Commercial agreement."
      );

      return 0;
    }

    if (
      currentStatus.status ===
        "rejected"
    ) {
      writeLine("");
      writeLine(
        "Commercial License request was not approved."
      );

      if (
        currentStatus
          .rejectionReason
      ) {
        writeLine(
          `Reason: ${currentStatus.rejectionReason}`
        );
      }

      return 1;
    }

    const requestResult =
      await client.requestUpgrade(
        installedLicenseKey
      );

    writeLine("");
    writeLine(
      "✓ Commercial License Request Submitted"
    );
    writeLine("");
    writeLine(
      `Request ID: ${requestResult.requestId}`
    );
    writeLine(
      "Status: Pending LCM review"
    );
    writeLine("");
    writeLine(
      "LCM will contact your registered Work Email regarding the Commercial agreement."
    );

    return 0;
  } catch (error) {
    writeLine(
      error instanceof Error
        ? error.message
        : "Unable to process the Commercial License request."
    );

    return 1;
  }
}
