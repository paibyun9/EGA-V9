"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGAUsageReporterError = void 0;
exports.createUsageReporter = createUsageReporter;
const crypto_1 = require("crypto");
const license_store_1 = require("./license-store");
class EGAUsageReporterError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name =
            "EGAUsageReporterError";
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGAUsageReporterError = EGAUsageReporterError;
function normalizeBaseUrl(value) {
    let url;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new EGAUsageReporterError("EGA_USAGE_REPORTER_CONFIG", "Usage API base URL is invalid.");
    }
    if (url.protocol !== "https:" &&
        !(url.protocol === "http:" &&
            (url.hostname ===
                "127.0.0.1" ||
                url.hostname ===
                    "localhost"))) {
        throw new EGAUsageReporterError("EGA_USAGE_REPORTER_CONFIG", "Usage API must use HTTPS except for localhost development.");
    }
    return url
        .toString()
        .replace(/\/$/, "");
}
function createUsageReporter(options) {
    const baseUrl = normalizeBaseUrl(options.apiBaseUrl);
    const fetchImplementation = options.fetchImplementation ??
        fetch;
    const readLicenseKey = options.readLicenseKey ??
        (() => (0, license_store_1.readEvaluationLicenseKey)());
    const timeoutMilliseconds = options.timeoutMilliseconds ??
        5000;
    const sdkVersion = options.sdkVersion ??
        "1.0.1";
    return {
        async recordGovernedExecution(input) {
            const evaluationLicenseKey = readLicenseKey();
            if (!evaluationLicenseKey) {
                throw new EGAUsageReporterError("EGA_USAGE_REPORTER_LICENSE", "No Evaluation License Key is stored.");
            }
            const eventId = input.eventId ??
                (0, crypto_1.randomUUID)();
            const occurredAt = input.occurredAt ??
                new Date();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
            try {
                let response;
                try {
                    response =
                        await fetchImplementation(`${baseUrl}/api/usage/events`, {
                            method: "POST",
                            headers: {
                                "content-type": "application/json",
                                accept: "application/json",
                                authorization: `Bearer ${evaluationLicenseKey}`
                            },
                            body: JSON.stringify({
                                eventId,
                                occurredAt: occurredAt
                                    .toISOString(),
                                environment: input.environment,
                                riskLevel: input.riskLevel,
                                executionResult: input.executionResult,
                                sdkVersion
                            }),
                            signal: controller.signal
                        });
                }
                catch (error) {
                    throw new EGAUsageReporterError("EGA_USAGE_REPORTER_NETWORK", error instanceof Error
                        ? error.message
                        : "Unable to send Usage Event.");
                }
                let body;
                try {
                    body =
                        await response.json();
                }
                catch {
                    throw new EGAUsageReporterError("EGA_USAGE_REPORTER_RESPONSE", "Usage API returned invalid JSON.");
                }
                if (!response.ok) {
                    const remote = body;
                    throw new EGAUsageReporterError("EGA_USAGE_REPORTER_RESPONSE", remote.error?.message ??
                        "Usage API rejected the event.");
                }
                const result = body;
                if ((result.status !==
                    "recorded" &&
                    result.status !==
                        "duplicate") ||
                    typeof result.eventId !==
                        "string") {
                    throw new EGAUsageReporterError("EGA_USAGE_REPORTER_RESPONSE", "Usage API response is invalid.");
                }
                return {
                    status: result.status,
                    eventId: result.eventId
                };
            }
            finally {
                clearTimeout(timeout);
            }
        }
    };
}
