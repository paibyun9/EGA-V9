"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGALicensePublicKeyError = exports.EGA_V9_LICENSE_PUBLIC_KEY_FINGERPRINT_SHA256 = void 0;
exports.loadEvaluationLicensePublicKey = loadEvaluationLicensePublicKey;
const crypto_1 = require("crypto");
/**
 * EGA V9 Production Root of Trust V1.
 *
 * Public verification material only.
 * The corresponding Private Key must remain exclusively
 * in the LCM License API secret environment.
 */
const OFFICIAL_EGA_V9_LICENSE_PUBLIC_KEY_PEM = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAXyuVTginxHK4uxGvwXxc3yMUvmNA4c+NJyIOLvEZx+4=\n-----END PUBLIC KEY-----";
exports.EGA_V9_LICENSE_PUBLIC_KEY_FINGERPRINT_SHA256 = "2caf94d33728abd5b61919a230cc2ef142762f98da036c3e2a02dfcdc536377d";
class EGALicensePublicKeyError extends Error {
    constructor(message) {
        super(`[EGA_LICENSE_PUBLIC_KEY] ${message}`);
        this.name =
            "EGALicensePublicKeyError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGALicensePublicKeyError = EGALicensePublicKeyError;
/**
 * Resolution order:
 *
 * 1. EGA_V9_LICENSE_PUBLIC_KEY_PEM or explicit argument
 *    for controlled development and testing.
 * 2. Official EGA V9 Production Public Key bundled
 *    with the SDK for normal customer activation.
 */
function loadEvaluationLicensePublicKey(publicKeyPem = process.env
    .EGA_V9_LICENSE_PUBLIC_KEY_PEM) {
    const selectedPublicKeyPem = typeof publicKeyPem === "string" &&
        publicKeyPem.trim().length > 0
        ? publicKeyPem.trim()
        : OFFICIAL_EGA_V9_LICENSE_PUBLIC_KEY_PEM;
    try {
        const publicKey = (0, crypto_1.createPublicKey)(selectedPublicKeyPem);
        if (publicKey.type !== "public" ||
            publicKey.asymmetricKeyType !==
                "ed25519") {
            throw new Error("Unsupported Public Key type.");
        }
        return publicKey;
    }
    catch {
        throw new EGALicensePublicKeyError("The configured EGA V9 Evaluation License public key is invalid.");
    }
}
