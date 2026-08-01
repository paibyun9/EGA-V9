"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGACommercialApiError = void 0;
exports.createCommercialApiClient = createCommercialApiClient;
class EGACommercialApiError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name =
            "EGACommercialApiError";
        this.code =
            code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGACommercialApiError = EGACommercialApiError;
function normalizeBaseUrl(value) {
    let url;
    try {
        url =
            new URL(value.trim());
    }
    catch {
        throw new EGACommercialApiError("EGA_COMMERCIAL_API_CONFIG", "Commercial License API URL is invalid.");
    }
    if (url.protocol !== "https:" &&
        !(url.protocol === "http:" &&
            (url.hostname ===
                "127.0.0.1" ||
                url.hostname ===
                    "localhost"))) {
        throw new EGACommercialApiError("EGA_COMMERCIAL_API_CONFIG", "Commercial License API must use HTTPS except for localhost development.");
    }
    return url
        .toString()
        .replace(/\/$/, "");
}
function createCommercialApiClient(options) {
    const baseUrl = normalizeBaseUrl(options.apiBaseUrl);
    const fetchImplementation = options.fetchImplementation ??
        fetch;
    const timeoutMilliseconds = options.timeoutMilliseconds ??
        10000;
    async function request(path, method, licenseKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
        try {
            let response;
            try {
                response =
                    await fetchImplementation(`${baseUrl}${path}`, {
                        method,
                        headers: {
                            accept: "application/json",
                            authorization: `Bearer ${licenseKey}`
                        },
                        signal: controller.signal
                    });
            }
            catch (error) {
                throw new EGACommercialApiError("EGA_COMMERCIAL_API_NETWORK", error instanceof Error
                    ? error.message
                    : "Unable to contact the Commercial License API.");
            }
            let body;
            try {
                body =
                    await response.json();
            }
            catch {
                throw new EGACommercialApiError("EGA_COMMERCIAL_API_RESPONSE", "Commercial License API returned invalid JSON.");
            }
            if (!response.ok) {
                throw new EGACommercialApiError("EGA_COMMERCIAL_API_RESPONSE", body?.error?.message ??
                    "Commercial License API rejected the request.");
            }
            return body;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    return {
        async requestUpgrade(licenseKey) {
            return await request("/api/licenses/commercial/request", "POST", licenseKey);
        },
        async getStatus(licenseKey) {
            return await request("/api/licenses/commercial/status", "GET", licenseKey);
        }
    };
}
