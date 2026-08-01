export type EGAUsageEnvironment = "development" | "production";
export type EGAUsageRiskLevel = "standard" | "high-risk";
export type EGAUsageExecutionResult = "allow" | "deny" | "contain";
export type EGAUsageEventInput = {
    environment: EGAUsageEnvironment;
    riskLevel: EGAUsageRiskLevel;
    executionResult: EGAUsageExecutionResult;
    occurredAt?: Date;
    eventId?: string;
};
export type EGAUsageReporterOptions = {
    apiBaseUrl: string;
    sdkVersion?: string;
    timeoutMilliseconds?: number;
    fetchImplementation?: typeof fetch;
    readLicenseKey?: () => string | null;
};
export declare class EGAUsageReporterError extends Error {
    readonly code: "EGA_USAGE_REPORTER_CONFIG" | "EGA_USAGE_REPORTER_LICENSE" | "EGA_USAGE_REPORTER_NETWORK" | "EGA_USAGE_REPORTER_RESPONSE";
    constructor(code: EGAUsageReporterError["code"], message: string);
}
export declare function createUsageReporter(options: EGAUsageReporterOptions): {
    recordGovernedExecution(input: EGAUsageEventInput): Promise<{
        status: "recorded" | "duplicate";
        eventId: string;
    }>;
};
