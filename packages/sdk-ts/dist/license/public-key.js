"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGALicensePublicKeyError = void 0;
exports.loadEvaluationLicensePublicKey = loadEvaluationLicensePublicKey;
const crypto_1 = require("crypto");
class EGALicensePublicKeyError extends Error {
    constructor(message) {
        super(`[EGA_LICENSE_PUBLIC_KEY] ${message}`);
        this.name =
            "EGALicensePublicKeyError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGALicensePublicKeyError = EGALicensePublicKeyError;
function loadEvaluationLicensePublicKey(publicKeyPem = process.env
    .EGA_V9_LICENSE_PUBLIC_KEY_PEM) {
    if (typeof publicKeyPem !==
        "string" ||
        publicKeyPem.trim().length ===
            0) {
        throw new EGALicensePublicKeyError("The official EGA V9 Evaluation License public key is not configured.");
    }
    try {
        return (0, crypto_1.createPublicKey)(publicKeyPem);
    }
    catch {
        throw new EGALicensePublicKeyError("The configured EGA V9 Evaluation License public key is invalid.");
    }
}
