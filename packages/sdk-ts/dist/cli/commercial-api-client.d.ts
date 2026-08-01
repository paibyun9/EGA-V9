export type EGACommercialUpgradeStatus = "pending" | "approved" | "rejected";
export type EGACommercialRequestResult = {
    created: boolean;
    requestId: string;
    status: EGACommercialUpgradeStatus;
};
export type EGACommercialStatusResult = {
    requested: boolean;
    requestId: string | null;
    status: EGACommercialUpgradeStatus | null;
    rejectionReason?: string | null;
    commercialLicenseKey?: string | null;
};
export type EGACommercialApiClientOptions = {
    apiBaseUrl: string;
    fetchImplementation?: typeof fetch;
    timeoutMilliseconds?: number;
};
export declare class EGACommercialApiError extends Error {
    readonly code: "EGA_COMMERCIAL_API_CONFIG" | "EGA_COMMERCIAL_API_NETWORK" | "EGA_COMMERCIAL_API_RESPONSE";
    constructor(code: EGACommercialApiError["code"], message: string);
}
export declare function createCommercialApiClient(options: EGACommercialApiClientOptions): {
    requestUpgrade(licenseKey: string): Promise<EGACommercialRequestResult>;
    getStatus(licenseKey: string): Promise<EGACommercialStatusResult>;
};
