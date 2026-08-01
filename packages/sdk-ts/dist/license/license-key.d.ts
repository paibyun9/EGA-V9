import { KeyObject } from "crypto";
import { EGALicense, EGAEvaluationLicense } from "./types";
export declare class EGALicenseKeyError extends Error {
    readonly code: "EGA_LICENSE_KEY_FORMAT" | "EGA_LICENSE_KEY_PAYLOAD" | "EGA_LICENSE_KEY_SIGNATURE" | "EGA_LICENSE_KEY_TYPE";
    constructor(code: EGALicenseKeyError["code"], message: string);
}
/**
 * Produces stable JSON for signature generation.
 *
 * The property order is explicitly controlled so that the same license
 * always produces the same payload bytes.
 */
export declare function serializeLicenseForSigning(license: EGALicense): string;
/**
 * Server-side function.
 *
 * This function requires the LCM private key and must not be called from
 * browser code or distributed with production private-key material.
 */
export declare function issueEvaluationLicenseKey(license: EGAEvaluationLicense, privateKey: string | Buffer | KeyObject): string;
/**
 * SDK-side function.
 *
 * Verifies the signature using only the public key and returns the trusted
 * Evaluation License payload.
 */
export declare function verifyEvaluationLicenseKey(evaluationLicenseKey: string, publicKey: string | Buffer | KeyObject): EGAEvaluationLicense;
/**
 * Verifies a signed EGA V9 License Key and returns either
 * an Evaluation License or a Commercial License.
 */
export declare function verifyLicenseKey(licenseKey: string, publicKey: string | Buffer | KeyObject): EGALicense;
