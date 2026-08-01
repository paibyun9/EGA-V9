import { KeyObject } from "crypto";
import { EGALicense } from "./types";
export type EGARuntimeAdmissionReason = "evaluation-active" | "commercial-active" | "license-missing" | "public-key-unavailable" | "license-verification-failed" | "evaluation-expired" | "commercial-expired" | "license-invalid";
export type EGARuntimeAdmissionDecision = {
    admitted: boolean;
    decision: "allow" | "deny";
    reason: EGARuntimeAdmissionReason;
    licenseKind: "evaluation" | "commercial" | null;
    licenseId: string | null;
    expiresAt: string | null;
    daysRemaining: number | null;
};
export type EGARuntimeAdmissionDependencies = {
    now?: Date;
    readLicenseKey?: () => string | null;
    loadPublicKey?: () => KeyObject;
    verifyLicenseKey?: (licenseKey: string, publicKey: KeyObject) => EGALicense;
};
export declare class EGARuntimeAdmissionError extends Error {
    readonly code: "EGA_RUNTIME_LICENSE_MISSING" | "EGA_RUNTIME_PUBLIC_KEY_UNAVAILABLE" | "EGA_RUNTIME_LICENSE_VERIFICATION_FAILED" | "EGA_RUNTIME_LICENSE_EXPIRED" | "EGA_RUNTIME_LICENSE_INVALID";
    readonly admission: EGARuntimeAdmissionDecision;
    constructor(args: {
        code: EGARuntimeAdmissionError["code"];
        message: string;
        admission: EGARuntimeAdmissionDecision;
        cause?: unknown;
    });
}
export declare function evaluateRuntimeAdmission(dependencies?: EGARuntimeAdmissionDependencies): EGARuntimeAdmissionDecision;
export declare function assertRuntimeLicenseAdmission(dependencies?: EGARuntimeAdmissionDependencies): EGARuntimeAdmissionDecision;
