import { KeyObject } from "crypto";
export declare class EGALicensePublicKeyError extends Error {
    constructor(message: string);
}
export declare function loadEvaluationLicensePublicKey(publicKeyPem?: string | undefined): KeyObject;
