import {
  createPublicKey,
  KeyObject
} from "crypto";

export class EGALicensePublicKeyError
  extends Error {
  constructor(message: string) {
    super(
      `[EGA_LICENSE_PUBLIC_KEY] ${message}`
    );

    this.name =
      "EGALicensePublicKeyError";

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

export function loadEvaluationLicensePublicKey(
  publicKeyPem:
    string | undefined =
      process.env
        .EGA_V9_LICENSE_PUBLIC_KEY_PEM
): KeyObject {
  if (
    typeof publicKeyPem !==
      "string" ||
    publicKeyPem.trim().length ===
      0
  ) {
    throw new EGALicensePublicKeyError(
      "The official EGA V9 Evaluation License public key is not configured."
    );
  }

  try {
    return createPublicKey(
      publicKeyPem
    );
  } catch {
    throw new EGALicensePublicKeyError(
      "The configured EGA V9 Evaluation License public key is invalid."
    );
  }
}
