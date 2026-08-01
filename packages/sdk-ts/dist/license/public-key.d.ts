import { KeyObject } from "crypto";
export declare const EGA_V9_LICENSE_PUBLIC_KEY_FINGERPRINT_SHA256 = "2caf94d33728abd5b61919a230cc2ef142762f98da036c3e2a02dfcdc536377d";
export declare class EGALicensePublicKeyError extends Error {
    constructor(message: string);
}
/**
 * Resolution order:
 *
 * 1. EGA_V9_LICENSE_PUBLIC_KEY_PEM or explicit argument
 *    for controlled development and testing.
 * 2. Official EGA V9 Production Public Key bundled
 *    with the SDK for normal customer activation.
 */
export declare function loadEvaluationLicensePublicKey(publicKeyPem?: string | undefined): KeyObject;
