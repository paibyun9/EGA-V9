import {
  KeyObject
} from "crypto";

import {
  evaluateCommercialLicense
} from "./evaluate-license";

import {
  verifyLicenseKey
} from "./license-key";

import {
  readEvaluationLicenseKey
} from "./license-store";

import {
  loadEvaluationLicensePublicKey
} from "./public-key";

import {
  EGALicense
} from "./types";

export type EGARuntimeAdmissionReason =
  | "evaluation-active"
  | "commercial-active"
  | "license-missing"
  | "public-key-unavailable"
  | "license-verification-failed"
  | "evaluation-expired"
  | "commercial-expired"
  | "license-invalid";

export type EGARuntimeAdmissionDecision = {
  admitted: boolean;
  decision: "allow" | "deny";
  reason: EGARuntimeAdmissionReason;
  licenseKind:
    | "evaluation"
    | "commercial"
    | null;
  licenseId: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
};

export type EGARuntimeAdmissionDependencies = {
  now?: Date;

  readLicenseKey?: () =>
    string | null;

  loadPublicKey?: () =>
    KeyObject;

  verifyLicenseKey?: (
    licenseKey: string,
    publicKey: KeyObject
  ) => EGALicense;
};

export class EGARuntimeAdmissionError
  extends Error {
  readonly code:
    | "EGA_RUNTIME_LICENSE_MISSING"
    | "EGA_RUNTIME_PUBLIC_KEY_UNAVAILABLE"
    | "EGA_RUNTIME_LICENSE_VERIFICATION_FAILED"
    | "EGA_RUNTIME_LICENSE_EXPIRED"
    | "EGA_RUNTIME_LICENSE_INVALID";

  readonly admission:
    EGARuntimeAdmissionDecision;

  constructor(args: {
    code:
      EGARuntimeAdmissionError["code"];
    message: string;
    admission:
      EGARuntimeAdmissionDecision;
    cause?: unknown;
  }) {
    super(
      `[${args.code}] ${args.message}`
    );

    this.name =
      "EGARuntimeAdmissionError";

    this.code =
      args.code;

    this.admission =
      args.admission;

    if (
      args.cause !== undefined
    ) {
      Object.defineProperty(
        this,
        "cause",
        {
          value:
            args.cause,
          enumerable:
            false,
          configurable:
            true
        }
      );
    }

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function denyAdmission(args: {
  reason:
    Exclude<
      EGARuntimeAdmissionReason,
      | "evaluation-active"
      | "commercial-active"
    >;
  licenseKind?:
    | "evaluation"
    | "commercial"
    | null;
  licenseId?: string | null;
  expiresAt?: string | null;
  daysRemaining?: number | null;
}): EGARuntimeAdmissionDecision {
  return {
    admitted: false,
    decision: "deny",
    reason: args.reason,
    licenseKind:
      args.licenseKind ?? null,
    licenseId:
      args.licenseId ?? null,
    expiresAt:
      args.expiresAt ?? null,
    daysRemaining:
      args.daysRemaining ?? null
  };
}

function allowAdmission(args: {
  reason:
    | "evaluation-active"
    | "commercial-active";
  license: EGALicense;
  daysRemaining:
    number | null;
}): EGARuntimeAdmissionDecision {
  return {
    admitted: true,
    decision: "allow",
    reason: args.reason,
    licenseKind:
      args.license.licenseKind,
    licenseId:
      args.license.licenseId,
    expiresAt:
      args.license.expiresAt ??
      null,
    daysRemaining:
      args.daysRemaining
  };
}

export function evaluateRuntimeAdmission(
  dependencies:
    EGARuntimeAdmissionDependencies = {}
): EGARuntimeAdmissionDecision {
  const now =
    dependencies.now ??
    new Date();

  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    const admission =
      denyAdmission({
        reason:
          "license-invalid"
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_LICENSE_INVALID",
      message:
        "The runtime license clock is invalid.",
      admission
    });
  }

  const readLicenseKey =
    dependencies.readLicenseKey ??
    (() =>
      readEvaluationLicenseKey());

  const loadPublicKey =
    dependencies.loadPublicKey ??
    (() =>
      loadEvaluationLicensePublicKey());

  const verifyInstalledLicense =
    dependencies.verifyLicenseKey ??
    verifyLicenseKey;

  const licenseKey =
    readLicenseKey();

  if (!licenseKey) {
    const admission =
      denyAdmission({
        reason:
          "license-missing"
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_LICENSE_MISSING",
      message:
        "No EGA V9 License Key is installed. Run `npx ega-v9 register` before starting governed execution.",
      admission
    });
  }

  let publicKey:
    KeyObject;

  try {
    publicKey =
      loadPublicKey();
  } catch (error) {
    const admission =
      denyAdmission({
        reason:
          "public-key-unavailable"
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_PUBLIC_KEY_UNAVAILABLE",
      message:
        "The official EGA V9 License Public Key is unavailable.",
      admission,
      cause: error
    });
  }

  let license:
    EGALicense;

  try {
    license =
      verifyInstalledLicense(
        licenseKey,
        publicKey
      );
  } catch (error) {
    const admission =
      denyAdmission({
        reason:
          "license-verification-failed"
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_LICENSE_VERIFICATION_FAILED",
      message:
        "The installed EGA V9 License Key could not be verified.",
      admission,
      cause: error
    });
  }

  let evaluation:
    ReturnType<
      typeof evaluateCommercialLicense
    >;

  try {
    evaluation =
      evaluateCommercialLicense(
        license,
        now
      );
  } catch (error) {
    const admission =
      denyAdmission({
        reason:
          "license-invalid",
        licenseKind:
          license.licenseKind,
        licenseId:
          license.licenseId,
        expiresAt:
          license.expiresAt ??
          null
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_LICENSE_INVALID",
      message:
        "The installed EGA V9 License is invalid.",
      admission,
      cause: error
    });
  }

  if (
    evaluation.executionAllowed ===
    false
  ) {
    const reason =
      license.licenseKind ===
        "commercial"
        ? "commercial-expired"
        : "evaluation-expired";

    const admission =
      denyAdmission({
        reason,
        licenseKind:
          license.licenseKind,
        licenseId:
          license.licenseId,
        expiresAt:
          license.expiresAt ??
          null,
        daysRemaining:
          evaluation.daysRemaining
      });

    throw new EGARuntimeAdmissionError({
      code:
        "EGA_RUNTIME_LICENSE_EXPIRED",
      message:
        license.licenseKind ===
          "commercial"
          ? "The EGA V9 Commercial License has expired. Governed execution is stopped."
          : "The 90-day EGA V9 Evaluation License has expired. Governed execution is stopped until a Commercial License is activated.",
      admission
    });
  }

  return allowAdmission({
    reason:
      license.licenseKind ===
        "commercial"
        ? "commercial-active"
        : "evaluation-active",
    license,
    daysRemaining:
      evaluation.daysRemaining
  });
}

export function assertRuntimeLicenseAdmission(
  dependencies:
    EGARuntimeAdmissionDependencies = {}
): EGARuntimeAdmissionDecision {
  return evaluateRuntimeAdmission(
    dependencies
  );
}
