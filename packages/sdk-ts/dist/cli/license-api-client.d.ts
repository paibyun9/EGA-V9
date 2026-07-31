import { EGARegistrationInput, EGARegistrationResponse } from "./register-command";
export type EGALicenseApiClientOptions = {
    baseUrl: string;
    timeoutMilliseconds?: number;
    fetchImplementation?: typeof fetch;
};
export declare class EGALicenseApiError extends Error {
    readonly code: "EGA_LICENSE_API_CONFIG" | "EGA_LICENSE_API_NETWORK" | "EGA_LICENSE_API_RESPONSE";
    readonly statusCode?: number;
    readonly remoteCode?: string;
    constructor(args: {
        code: EGALicenseApiError["code"];
        message: string;
        statusCode?: number;
        remoteCode?: string;
    });
}
export declare function createLicenseApiClient(options: EGALicenseApiClientOptions): {
    issueEvaluationLicense(input: EGARegistrationInput): Promise<EGARegistrationResponse>;
};
