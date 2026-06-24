export type EGATrustLevel = "supported" | "verified";
export type EGAStatus = "verified" | "contained" | "failed";
export type EGADetectionStatus = "match" | "mismatch";
export type EGAContainmentMode = "observe" | "fail-closed";
export type EGAEventType = "workflow.started" | "workflow.verified" | "replay.mismatch" | "hash.verified" | "mutation.detected" | "containment.activated" | "execution.blocked" | "quarantine.created";
export type EGAEvent = {
    type: EGAEventType;
    timestamp: string;
    requestId: string;
    replayRoot: string;
    trustLevel: EGATrustLevel;
    status: EGAStatus;
    details?: Record<string, unknown>;
};
export type EGARequestContext = {
    requestId: string;
    replayRoot: string;
    trustLevel: EGATrustLevel;
    status: EGAStatus;
    scorpLock: boolean;
    detection: {
        status: EGADetectionStatus;
        expectedReplayRoot?: string;
        actualReplayRoot: string;
    };
    containment: {
        activated: boolean;
        mode: EGAContainmentMode;
        reason?: string;
        quarantineId?: string;
        executionAllowed: boolean;
    };
};
export type EGAOptions = {
    appName?: string;
    trustLevel?: EGATrustLevel;
    telemetry?: boolean;
    failClosed?: boolean;
};
type NextFunction = () => void;
type EGARequest = {
    method?: string;
    originalUrl?: string;
    url?: string;
    path?: string;
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: Record<string, unknown>;
    ega?: EGARequestContext;
};
type EGAResponse = {
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    status?: (code: number) => EGAResponse;
    json?: (body: unknown) => void;
};
export declare class EGA {
    private readonly options;
    private readonly eventLog;
    private constructor();
    static init(options?: EGAOptions): EGA;
    guard(): (req: EGARequest, res: EGAResponse, next: NextFunction) => void;
    events(): EGAEvent[];
    canonicalize(input: unknown): string;
    replayRoot(input: unknown): string;
    detect(input: unknown, expectedReplayRoot?: string): {
        status: "match" | "mismatch";
        expectedReplayRoot: string | undefined;
        actualReplayRoot: string;
    };
    private createReplayRoot;
    private getExpectedReplayRoot;
    private recordEvent;
}
export declare function verifyExecution(input: unknown): EGARequestContext;
export declare function replay(input: unknown): EGARequestContext;
export declare function provenance(input: unknown): EGARequestContext;
export declare function contain(input: unknown): EGARequestContext;
export {};
