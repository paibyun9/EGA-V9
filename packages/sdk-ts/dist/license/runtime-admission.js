"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGARuntimeAdmissionError = void 0;
exports.evaluateRuntimeAdmission = evaluateRuntimeAdmission;
exports.assertRuntimeLicenseAdmission = assertRuntimeLicenseAdmission;
const evaluate_license_1 = require("./evaluate-license");
const license_key_1 = require("./license-key");
const license_store_1 = require("./license-store");
const public_key_1 = require("./public-key");
class EGARuntimeAdmissionError extends Error {
    constructor(args) {
        super(`[${args.code}] ${args.message}`);
        this.name =
            "EGARuntimeAdmissionError";
        this.code =
            args.code;
        this.admission =
            args.admission;
        if (args.cause !== undefined) {
            Object.defineProperty(this, "cause", {
                value: args.cause,
                enumerable: false,
                configurable: true
            });
        }
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGARuntimeAdmissionError = EGARuntimeAdmissionError;
function denyAdmission(args) {
    return {
        admitted: false,
        decision: "deny",
        reason: args.reason,
        licenseKind: args.licenseKind ?? null,
        licenseId: args.licenseId ?? null,
        expiresAt: args.expiresAt ?? null,
        daysRemaining: args.daysRemaining ?? null
    };
}
function allowAdmission(args) {
    return {
        admitted: true,
        decision: "allow",
        reason: args.reason,
        licenseKind: args.license.licenseKind,
        licenseId: args.license.licenseId,
        expiresAt: args.license.expiresAt ??
            null,
        daysRemaining: args.daysRemaining
    };
}
function evaluateRuntimeAdmission(dependencies = {}) {
    const now = dependencies.now ??
        new Date();
    if (!(now instanceof Date) ||
        Number.isNaN(now.getTime())) {
        const admission = denyAdmission({
            reason: "license-invalid"
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_LICENSE_INVALID",
            message: "The runtime license clock is invalid.",
            admission
        });
    }
    const readLicenseKey = dependencies.readLicenseKey ??
        (() => (0, license_store_1.readEvaluationLicenseKey)());
    const loadPublicKey = dependencies.loadPublicKey ??
        (() => (0, public_key_1.loadEvaluationLicensePublicKey)());
    const verifyInstalledLicense = dependencies.verifyLicenseKey ??
        license_key_1.verifyLicenseKey;
    const licenseKey = readLicenseKey();
    if (!licenseKey) {
        const admission = denyAdmission({
            reason: "license-missing"
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_LICENSE_MISSING",
            message: "No EGA V9 License Key is installed. Run `npx ega-v9 register` before starting governed execution.",
            admission
        });
    }
    let publicKey;
    try {
        publicKey =
            loadPublicKey();
    }
    catch (error) {
        const admission = denyAdmission({
            reason: "public-key-unavailable"
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_PUBLIC_KEY_UNAVAILABLE",
            message: "The official EGA V9 License Public Key is unavailable.",
            admission,
            cause: error
        });
    }
    let license;
    try {
        license =
            verifyInstalledLicense(licenseKey, publicKey);
    }
    catch (error) {
        const admission = denyAdmission({
            reason: "license-verification-failed"
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_LICENSE_VERIFICATION_FAILED",
            message: "The installed EGA V9 License Key could not be verified.",
            admission,
            cause: error
        });
    }
    let evaluation;
    try {
        evaluation =
            (0, evaluate_license_1.evaluateCommercialLicense)(license, now);
    }
    catch (error) {
        const admission = denyAdmission({
            reason: "license-invalid",
            licenseKind: license.licenseKind,
            licenseId: license.licenseId,
            expiresAt: license.expiresAt ??
                null
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_LICENSE_INVALID",
            message: "The installed EGA V9 License is invalid.",
            admission,
            cause: error
        });
    }
    if (evaluation.executionAllowed ===
        false) {
        const reason = license.licenseKind ===
            "commercial"
            ? "commercial-expired"
            : "evaluation-expired";
        const admission = denyAdmission({
            reason,
            licenseKind: license.licenseKind,
            licenseId: license.licenseId,
            expiresAt: license.expiresAt ??
                null,
            daysRemaining: evaluation.daysRemaining
        });
        throw new EGARuntimeAdmissionError({
            code: "EGA_RUNTIME_LICENSE_EXPIRED",
            message: license.licenseKind ===
                "commercial"
                ? "The EGA V9 Commercial License has expired. Governed execution is stopped."
                : "The 90-day EGA V9 Evaluation License has expired. Governed execution is stopped until a Commercial License is activated.",
            admission
        });
    }
    return allowAdmission({
        reason: license.licenseKind ===
            "commercial"
            ? "commercial-active"
            : "evaluation-active",
        license,
        daysRemaining: evaluation.daysRemaining
    });
}
function assertRuntimeLicenseAdmission(dependencies = {}) {
    return evaluateRuntimeAdmission(dependencies);
}
