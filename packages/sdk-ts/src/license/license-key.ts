import {
  createPrivateKey,
  createPublicKey,
  KeyObject,
  sign,
  verify
} from "crypto";

import {
  EGALicense,
  EGAEvaluationLicense
} from "./types";

const LICENSE_KEY_PREFIX = "EGA9-LIC-V1";

export class EGALicenseKeyError extends Error {
  readonly code:
    | "EGA_LICENSE_KEY_FORMAT"
    | "EGA_LICENSE_KEY_PAYLOAD"
    | "EGA_LICENSE_KEY_SIGNATURE"
    | "EGA_LICENSE_KEY_TYPE";

  constructor(
    code: EGALicenseKeyError["code"],
    message: string
  ) {
    super(`[${code}] ${message}`);
    this.name = "EGALicenseKeyError";
    this.code = code;

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function encodeBase64Url(
  value: Buffer | string
): string {
  return Buffer
    .from(value)
    .toString("base64url");
}

function decodeBase64Url(
  value: string
): Buffer {
  try {
    return Buffer.from(
      value,
      "base64url"
    );
  } catch {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_FORMAT",
      "Evaluation License Key contains invalid Base64URL data."
    );
  }
}

/**
 * Produces stable JSON for signature generation.
 *
 * The property order is explicitly controlled so that the same license
 * always produces the same payload bytes.
 */
export function serializeLicenseForSigning(
  license: EGALicense
): string {
  if (license.licenseKind === "evaluation") {
    return JSON.stringify({
      schemaVersion: license.schemaVersion,
      licenseKind: license.licenseKind,
      licenseId: license.licenseId,
      contactName: license.contactName,
      companyName: license.companyName,
      workEmail: license.workEmail,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt
    });
  }

  return JSON.stringify({
    schemaVersion: license.schemaVersion,
    licenseKind: license.licenseKind,
    licenseId: license.licenseId,
    contactName: license.contactName,
    companyName: license.companyName,
    workEmail: license.workEmail,
    issuedAt: license.issuedAt,
    ...(license.expiresAt
      ? { expiresAt: license.expiresAt }
      : {})
  });
}

function toPrivateKey(
  key: string | Buffer | KeyObject
): KeyObject {
  try {
    return key instanceof KeyObject
      ? key
      : createPrivateKey(key);
  } catch {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_SIGNATURE",
      "A valid Ed25519 private key is required to issue an Evaluation License Key."
    );
  }
}

function toPublicKey(
  key: string | Buffer | KeyObject
): KeyObject {
  try {
    return key instanceof KeyObject
      ? key
      : createPublicKey(key);
  } catch {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_SIGNATURE",
      "A valid Ed25519 public key is required to verify an Evaluation License Key."
    );
  }
}

function assertEvaluationLicense(
  value: unknown
): asserts value is EGAEvaluationLicense {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License payload must be an object."
    );
  }

  const license =
    value as Record<string, unknown>;

  if (
    license.schemaVersion !== 1 ||
    license.licenseKind !== "evaluation"
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_TYPE",
      "Evaluation License Key must contain a version 1 evaluation license."
    );
  }

  const requiredStringFields = [
    "licenseId",
    "contactName",
    "companyName",
    "workEmail",
    "issuedAt",
    "expiresAt"
  ] as const;

  for (
    const field of requiredStringFields
  ) {
    if (
      typeof license[field] !== "string" ||
      license[field].trim().length === 0
    ) {
      throw new EGALicenseKeyError(
        "EGA_LICENSE_KEY_PAYLOAD",
        `Evaluation License payload requires a non-empty ${field}.`
      );
    }
  }

  const email =
    String(license.workEmail);

  if (
    !email.includes("@") ||
    email.startsWith("@") ||
    email.endsWith("@")
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License payload contains an invalid workEmail."
    );
  }

  const issuedAt =
    new Date(String(license.issuedAt));

  const expiresAt =
    new Date(String(license.expiresAt));

  if (
    Number.isNaN(issuedAt.getTime()) ||
    Number.isNaN(expiresAt.getTime())
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License dates must be valid ISO-8601 date strings."
    );
  }

  if (
    expiresAt.getTime() <=
    issuedAt.getTime()
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License expiresAt must be later than issuedAt."
    );
  }
}

function assertCommercialLicense(
  value: unknown
): asserts value is EGALicense {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Commercial License payload must be an object."
    );
  }

  const license =
    value as Record<string, unknown>;

  if (
    license.schemaVersion !== 1 ||
    license.licenseKind !==
      "commercial"
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_TYPE",
      "Commercial License Key must contain a version 1 commercial license."
    );
  }

  const requiredStringFields = [
    "licenseId",
    "contactName",
    "companyName",
    "workEmail",
    "issuedAt"
  ] as const;

  for (
    const field of
    requiredStringFields
  ) {
    if (
      typeof license[field] !==
        "string" ||
      license[field].trim().length ===
        0
    ) {
      throw new EGALicenseKeyError(
        "EGA_LICENSE_KEY_PAYLOAD",
        `Commercial License payload requires a non-empty ${field}.`
      );
    }
  }

  const email =
    String(license.workEmail);

  if (
    !email.includes("@") ||
    email.startsWith("@") ||
    email.endsWith("@")
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Commercial License payload contains an invalid workEmail."
    );
  }

  const issuedAt =
    new Date(
      String(license.issuedAt)
    );

  if (
    Number.isNaN(
      issuedAt.getTime()
    )
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Commercial License issuedAt must be a valid ISO-8601 date string."
    );
  }

  if (
    license.expiresAt !==
      undefined
  ) {
    if (
      typeof license.expiresAt !==
        "string" ||
      license.expiresAt.trim()
        .length === 0
    ) {
      throw new EGALicenseKeyError(
        "EGA_LICENSE_KEY_PAYLOAD",
        "Commercial License expiresAt must be a valid non-empty ISO-8601 date string when provided."
      );
    }

    const expiresAt =
      new Date(
        license.expiresAt
      );

    if (
      Number.isNaN(
        expiresAt.getTime()
      ) ||
      expiresAt.getTime() <=
        issuedAt.getTime()
    ) {
      throw new EGALicenseKeyError(
        "EGA_LICENSE_KEY_PAYLOAD",
        "Commercial License expiresAt must be later than issuedAt."
      );
    }
  }
}

function assertLicense(
  value: unknown
): asserts value is EGALicense {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "License payload must be an object."
    );
  }

  const license =
    value as Record<string, unknown>;

  if (
    license.licenseKind ===
      "evaluation"
  ) {
    assertEvaluationLicense(value);
    return;
  }

  if (
    license.licenseKind ===
      "commercial"
  ) {
    assertCommercialLicense(value);
    return;
  }

  throw new EGALicenseKeyError(
    "EGA_LICENSE_KEY_TYPE",
    "License Key contains an unsupported license type."
  );
}

/**
 * Server-side function.
 *
 * This function requires the LCM private key and must not be called from
 * browser code or distributed with production private-key material.
 */
export function issueEvaluationLicenseKey(
  license: EGAEvaluationLicense,
  privateKey: string | Buffer | KeyObject
): string {
  assertEvaluationLicense(license);

  const payload =
    serializeLicenseForSigning(license);

  const signature = sign(
    null,
    Buffer.from(payload, "utf8"),
    toPrivateKey(privateKey)
  );

  return [
    LICENSE_KEY_PREFIX,
    encodeBase64Url(payload),
    encodeBase64Url(signature)
  ].join(".");
}

/**
 * SDK-side function.
 *
 * Verifies the signature using only the public key and returns the trusted
 * Evaluation License payload.
 */
export function verifyEvaluationLicenseKey(
  evaluationLicenseKey: string,
  publicKey: string | Buffer | KeyObject
): EGAEvaluationLicense {
  if (
    typeof evaluationLicenseKey !== "string" ||
    evaluationLicenseKey.trim().length === 0
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_FORMAT",
      "Evaluation License Key is required."
    );
  }

  const parts =
    evaluationLicenseKey.split(".");

  if (
    parts.length !== 3 ||
    parts[0] !== LICENSE_KEY_PREFIX
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_FORMAT",
      "Evaluation License Key has an unsupported format."
    );
  }

  const payloadBuffer =
    decodeBase64Url(parts[1]);

  const signatureBuffer =
    decodeBase64Url(parts[2]);

  const signatureIsValid = verify(
    null,
    payloadBuffer,
    toPublicKey(publicKey),
    signatureBuffer
  );

  if (!signatureIsValid) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_SIGNATURE",
      "Evaluation License Key signature verification failed."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      payloadBuffer.toString("utf8")
    );
  } catch {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License Key payload is not valid JSON."
    );
  }

  assertEvaluationLicense(parsed);

  const canonicalPayload =
    serializeLicenseForSigning(parsed);

  if (
    canonicalPayload !==
    payloadBuffer.toString("utf8")
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "Evaluation License Key payload is not canonical."
    );
  }

  return parsed;
}

/**
 * Verifies a signed EGA V9 License Key and returns either
 * an Evaluation License or a Commercial License.
 */
export function verifyLicenseKey(
  licenseKey: string,
  publicKey: string | Buffer | KeyObject
): EGALicense {
  if (
    typeof licenseKey !== "string" ||
    licenseKey.trim().length === 0
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_FORMAT",
      "EGA V9 License Key is required."
    );
  }

  const parts =
    licenseKey.split(".");

  if (
    parts.length !== 3 ||
    parts[0] !== LICENSE_KEY_PREFIX
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_FORMAT",
      "EGA V9 License Key has an unsupported format."
    );
  }

  const payloadBuffer =
    decodeBase64Url(parts[1]);

  const signatureBuffer =
    decodeBase64Url(parts[2]);

  const signatureIsValid =
    verify(
      null,
      payloadBuffer,
      toPublicKey(publicKey),
      signatureBuffer
    );

  if (!signatureIsValid) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_SIGNATURE",
      "EGA V9 License Key signature verification failed."
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        payloadBuffer.toString(
          "utf8"
        )
      );
  } catch {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "EGA V9 License Key payload is not valid JSON."
    );
  }

  assertLicense(parsed);

  const canonicalPayload =
    serializeLicenseForSigning(
      parsed
    );

  if (
    canonicalPayload !==
    payloadBuffer.toString(
      "utf8"
    )
  ) {
    throw new EGALicenseKeyError(
      "EGA_LICENSE_KEY_PAYLOAD",
      "EGA V9 License Key payload is not canonical."
    );
  }

  return parsed;
}
