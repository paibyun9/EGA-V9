export type EGATrustLevel = "supported" | "verified";
export type EGAStatus = "verified" | "contained" | "failed";
export type EGADetectionStatus = "match" | "mismatch";
export type EGAContainmentMode = "observe" | "fail-closed";
export type EGATrustTier = "T1" | "T2" | "T3" | "T4";
export type EGAEventType = "workflow.started" | "workflow.verified" | "replay.mismatch" | "hash.verified" | "mutation.detected" | "containment.activated" | "execution.blocked" | "quarantine.created" | "lineage.reconstructed" | "business.metrics.collected" | "trust.evaluated" | "trust.escalated" | "approval.required" | "privilege.escalation.gated" | "mitre.mapped" | "eventbus.event.recorded";
export type EGAClientIdentity = {
    anonymousClientId: string;
    source: "host-header" | "unknown";
    domainHint?: string;
};
export type EGALicenseState = {
    mode: "alpha" | "enterprise";
    status: "active" | "grace" | "suspended" | "expired";
    enforcement: "disabled" | "observe" | "warn" | "protect" | "block";
    reason: string;
};
export type EGAMitreAtlasMapping = {
    mapped: boolean;
    attackType: string;
    atlasTechnique: string;
    attackTechnique: string;
    severity: "none" | "low" | "medium" | "high" | "critical";
    reason: string;
};
export type EGAEvent = {
    id: string;
    sequence: number;
    type: EGAEventType;
    timestamp: string;
    requestId: string;
    replayRoot: string;
    trustLevel: EGATrustLevel;
    status: EGAStatus;
    clientIdentity?: EGAClientIdentity;
    licenseState?: EGALicenseState;
    details?: Record<string, unknown>;
};
export type EGAEventSummary = {
    total: number;
    byType: Record<string, number>;
    latest?: EGAEvent;
};
export type EGABusinessMetrics = {
    detected: boolean;
    amount?: number;
    price?: number;
    quantity?: number;
    currency?: string;
    estimatedTransactionValue?: number;
};
export type EGABusinessTrustProfile = {
    currentTier: EGATrustTier;
    riskScore: number;
    approvalRequired: boolean;
    privilegeEscalationGate: boolean;
    reason: string;
};
export type EGABusinessGovernanceProfile = {
    metrics: EGABusinessMetrics;
    trust: EGABusinessTrustProfile;
};
export type EGAProvenanceNodeType = "input" | "tool_output" | "policy" | "decision" | "business_metrics" | "trust_escalation";
export type EGAProvenanceNode = {
    id: string;
    type: EGAProvenanceNodeType;
    label: string;
    data: Record<string, unknown>;
};
export type EGAProvenanceEdge = {
    from: string;
    to: string;
    label: string;
};
export type EGAProvenanceGraph = {
    graphId: string;
    lineage: string[];
    nodes: EGAProvenanceNode[];
    edges: EGAProvenanceEdge[];
    businessMetrics: EGABusinessMetrics;
    businessGovernanceProfile: EGABusinessGovernanceProfile;
};
export type EGARequestContext = {
    requestId: string;
    replayRoot: string;
    trustLevel: EGATrustLevel;
    status: EGAStatus;
    scorpLock: boolean;
    clientIdentity: EGAClientIdentity;
    licenseState: EGALicenseState;
    mitreMapping: EGAMitreAtlasMapping;
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
    trust: EGABusinessTrustProfile;
    businessGovernanceProfile: EGABusinessGovernanceProfile;
    provenance: EGAProvenanceGraph;
};
export type EGAGuardDecision = {
    verified: boolean;
    containmentRequired: boolean;
    executionAllowed: boolean;
    trustState: EGATrustTier;
    reason: string | null;
    latencyMicroseconds: number;
    verification: EGARequestContext;
};
export type EGAGuardRequest = {
    method?: string;
    originalUrl?: string;
    url?: string;
    path?: string;
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: Record<string, unknown>;
    egaWorkflow?: unknown;
    ega?: EGARequestContext;
    egaDecision?: EGAGuardDecision;
};
export type EGAGuardResponse = {
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    status?: (code: number) => EGAGuardResponse;
    json?: (body: unknown) => void;
};
export type EGAGuardNext = (error?: unknown) => void;
export type EGAWorkflowResolver = (req: EGAGuardRequest) => unknown | Promise<unknown>;
export type EGAGuardOptions = {
    mode?: "observe" | "fail-closed";
    statusCode?: number;
    policyId?: string;
    resolveWorkflow?: EGAWorkflowResolver;
    onVerified?: (decision: EGAGuardDecision) => void | Promise<void>;
    onContained?: (decision: EGAGuardDecision) => void | Promise<void>;
};
export type EGAOptions = {
    appName?: string;
    trustLevel?: EGATrustLevel;
    telemetry?: boolean;
    failClosed?: boolean;
    policyId?: string;
    approvalThreshold?: number;
};
type NextFunction = EGAGuardNext;
type EGARequest = EGAGuardRequest;
type EGAResponse = EGAGuardResponse;
export declare class EGA {
    private readonly options;
    private readonly eventLog;
    private eventSequence;
    private constructor();
    static init(options?: EGAOptions): EGA;
    guard(): (req: EGARequest, res: EGAResponse, next: NextFunction) => void;
    events(type?: EGAEventType): EGAEvent[];
    latestEvents(limit?: number): EGAEvent[];
    eventSummary(): EGAEventSummary;
    explain(context?: EGARequestContext): EGAProvenanceGraph | undefined;
    canonicalize(input: unknown): string;
    replayRoot(input: unknown): string;
    detect(input: unknown, expectedReplayRoot?: string): {
        status: "match" | "mismatch";
        expectedReplayRoot: string | undefined;
        actualReplayRoot: string;
    };
    private createReplayRoot;
    private buildProvenanceGraph;
    private getExpectedReplayRoot;
    private recordEvent;
}
export declare function verifyExecution(input: unknown): EGARequestContext;
export declare function replay(input: unknown): EGARequestContext;
export declare function provenance(input: unknown): EGARequestContext;
export declare function contain(input: unknown): EGARequestContext;
declare function createGuard(options?: EGAGuardOptions): (req: EGAGuardRequest, res: EGAGuardResponse, next: EGAGuardNext) => Promise<void>;
export declare const ega: Readonly<{
    guard: typeof createGuard;
}>;
export {};
