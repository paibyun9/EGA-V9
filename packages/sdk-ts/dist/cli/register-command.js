"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGARegisterCommandError = void 0;
exports.runRegisterCommand = runRegisterCommand;
const activation_success_message_1 = require("./activation-success-message");
class EGARegisterCommandError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name =
            "EGARegisterCommandError";
        this.code =
            code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGARegisterCommandError = EGARegisterCommandError;
function requireNonEmpty(value, fieldName) {
    if (typeof value !== "string" ||
        value.trim().length === 0) {
        throw new EGARegisterCommandError("EGA_REGISTER_INPUT", `${fieldName} is required.`);
    }
    return value.trim();
}
function validateWorkEmail(value) {
    const workEmail = requireNonEmpty(value, "Work Email").toLowerCase();
    const simpleEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailPattern.test(workEmail)) {
        throw new EGARegisterCommandError("EGA_REGISTER_INPUT", "Work Email must be a valid email address.");
    }
    return workEmail;
}
function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date
        .toISOString()
        .slice(0, 10);
}
async function runRegisterCommand(dependencies) {
    dependencies.write("");
    dependencies.write("Welcome to EGA V9");
    dependencies.write("");
    dependencies.write("Activate your 90-day Evaluation License.");
    dependencies.write("No credit card required.");
    dependencies.write("");
    const contactName = requireNonEmpty(await dependencies.ask("Contact Name: "), "Contact Name");
    const companyName = requireNonEmpty(await dependencies.ask("Company Name: "), "Company Name");
    const workEmail = validateWorkEmail(await dependencies.ask("Work Email: "));
    let response;
    try {
        response =
            await dependencies
                .issueEvaluationLicense({
                contactName,
                companyName,
                workEmail
            });
    }
    catch (error) {
        throw new EGARegisterCommandError("EGA_REGISTER_SERVICE", `Unable to activate the Evaluation License: ${error instanceof Error
            ? error.message
            : "unknown service error"}`);
    }
    if (!response ||
        typeof response.evaluationLicenseKey !==
            "string" ||
        response.evaluationLicenseKey.trim()
            .length === 0) {
        throw new EGARegisterCommandError("EGA_REGISTER_RESPONSE", "The License Service returned an invalid Evaluation License Key.");
    }
    const evaluationLicenseKey = response.evaluationLicenseKey.trim();
    const license = dependencies
        .verifyEvaluationLicenseKey(evaluationLicenseKey);
    const licensePath = dependencies
        .saveEvaluationLicenseKey(evaluationLicenseKey, {
        overwrite: dependencies.overwrite ??
            false
    });
    dependencies.write((0, activation_success_message_1.buildActivationSuccessMessage)({
        contactName,
        companyName,
        workEmail,
        issuedAt: formatDate(license.issuedAt),
        expiresAt: formatDate(license.expiresAt)
    }));
    return {
        license,
        licensePath
    };
}
