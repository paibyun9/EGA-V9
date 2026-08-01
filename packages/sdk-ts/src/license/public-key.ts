import {
  createPublicKey,
  KeyObject
} from "crypto";

/**
 * EGA V9 Production Root of Trust V1.
 *
 * Public verification material only.
 * The corresponding Private Key must remain exclusively
 * in the LCM License API secret environment.
 */
const OFFICIAL_EGA_V9_LICENSE_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAXyuVTginxHK4uxGvwXxc3yMUvmNA4c+NJyIOLvEZx+4=\n-----END PUBLIC KEY-----";

export const EGA_V9_LICENSE_PUBLIC_KEY_FINGERPRINT_SHA256 =
  "2caf94d33728abd5b61919a230cc2ef142762f98da036c3e2a02dfcdc536377d";

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

/**
 * Resolution order:
 *
 * 1. EGA_V9_LICENSE_PUBLIC_KEY_PEM or explicit argument
 *    for controlled development and testing.
 * 2. Official EGA V9 Production Public Key bundled
 *    with the SDK for normal customer activation.
 */
export function loadEvaluationLicensePublicKey(
  publicKeyPem:
    string | undefined =
      process.env
        .EGA_V9_LICENSE_PUBLIC_KEY_PEM
): KeyObject {
  const selectedPublicKeyPem =
    typeof publicKeyPem === "string" &&
    publicKeyPem.trim().length > 0
      ? publicKeyPem.trim()
      : OFFICIAL_EGA_V9_LICENSE_PUBLIC_KEY_PEM;

  try {
    const publicKey =
      createPublicKey(
        selectedPublicKeyPem
      );

    if (
      publicKey.type !== "public" ||
      publicKey.asymmetricKeyType !==
        "ed25519"
    ) {
      throw new Error(
        "Unsupported Public Key type."
      );
    }

    return publicKey;
  } catch {
    throw new EGALicensePublicKeyError(
      "The configured EGA V9 Evaluation License public key is invalid."
    );
  }
}
