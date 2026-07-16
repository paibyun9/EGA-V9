"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ega = exports.EGA = void 0;
exports.verifyExecution = verifyExecution;
exports.replay = replay;
exports.provenance = provenance;
exports.contain = contain;
const crypto_1 = require("crypto");
class EGA {
    constructor(options = {}) {
        this.eventLog = [];
        this.eventSequence = 0;
        this.options = {
            appName: options.appName ?? "ega-v9-app",
            trustLevel: options.trustLevel ?? "supported",
            telemetry: options.telemetry ?? false,
            failClosed: options.failClosed ?? true,
            policyId: options.policyId ?? "default-policy",
            approvalThreshold: options.approvalThreshold ?? 70
        };
    }
    static init(options = {}) {
        return new EGA(options);
    }
    guard() {
        return (req, res, next) => {
            const requestId = (0, crypto_1.randomUUID)();
            const clientIdentity = buildAnonymousClientIdentity(req, this.options.appName);
            const licenseState = evaluateLicenseState(req);
            const actualReplayRoot = this.createReplayRoot(req);
            const expectedReplayRoot = this.getExpectedReplayRoot(req);
            this.recordEvent({
                type: "workflow.started",
                timestamp: new Date().toISOString(),
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: this.options.trustLevel,
                status: "verified",
                clientIdentity,
                licenseState
            });
            const isMismatch = typeof expectedReplayRoot === "string" &&
                expectedReplayRoot.length > 0 &&
                expectedReplayRoot !== actualReplayRoot;
            const mitreMapping = mapMitreAtlas(req, isMismatch);
            const quarantineId = isMismatch ? `q_${requestId}` : undefined;
            const businessMetrics = collectBusinessMetrics(req.body);
            const trust = evaluateTrust({
                isMismatch,
                failClosed: this.options.failClosed,
                businessMetrics,
                approvalThreshold: this.options.approvalThreshold
            });
            const businessGovernanceProfile = buildBusinessGovernanceProfile(businessMetrics, trust);
            const provenance = this.buildProvenanceGraph({
                requestId,
                replayRoot: actualReplayRoot,
                req,
                isMismatch,
                businessMetrics,
                businessGovernanceProfile
            });
            const context = {
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: this.options.trustLevel,
                status: isMismatch ? "contained" : "verified",
                scorpLock: true,
                clientIdentity,
                licenseState,
                mitreMapping,
                detection: {
                    status: isMismatch ? "mismatch" : "match",
                    expectedReplayRoot,
                    actualReplayRoot
                },
                containment: {
                    activated: isMismatch,
                    mode: this.options.failClosed ? "fail-closed" : "observe",
                    reason: isMismatch ? "replay root mismatch" : undefined,
                    quarantineId,
                    executionAllowed: !isMismatch || !this.options.failClosed
                },
                trust,
                businessGovernanceProfile,
                provenance
            };
            req.ega = context;
            res.setHeader?.("x-ega-request-id", requestId);
            res.setHeader?.("x-ega-replay-root", actualReplayRoot);
            res.setHeader?.("x-ega-trust-level", context.trustLevel);
            res.setHeader?.("x-ega-scorp-lock", "true");
            res.setHeader?.("x-ega-detection", context.detection.status);
            res.setHeader?.("x-ega-containment", context.containment.activated ? "activated" : "inactive");
            res.setHeader?.("x-ega-execution-allowed", String(context.containment.executionAllowed));
            res.setHeader?.("x-ega-trust-tier", context.trust.currentTier);
            res.setHeader?.("x-ega-risk-score", String(context.trust.riskScore));
            res.setHeader?.("x-ega-approval-required", String(context.trust.approvalRequired));
            res.setHeader?.("x-ega-client-id", context.clientIdentity.anonymousClientId);
            res.setHeader?.("x-ega-license-status", context.licenseState.status);
            res.setHeader?.("x-ega-license-enforcement", context.licenseState.enforcement);
            res.setHeader?.("x-ega-atlas-technique", context.mitreMapping.atlasTechnique);
            res.setHeader?.("x-ega-severity", context.mitreMapping.severity);
            this.recordEvent({
                type: "lineage.reconstructed",
                timestamp: new Date().toISOString(),
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: context.trustLevel,
                status: context.status,
                clientIdentity,
                licenseState,
                details: {
                    graphId: provenance.graphId,
                    lineage: provenance.lineage
                }
            });
            if (businessMetrics.detected) {
                this.recordEvent({
                    type: "business.metrics.collected",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: businessMetrics
                });
            }
            this.recordEvent({
                type: "trust.evaluated",
                timestamp: new Date().toISOString(),
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: context.trustLevel,
                status: context.status,
                clientIdentity,
                licenseState,
                details: trust
            });
            if (mitreMapping.mapped) {
                this.recordEvent({
                    type: "mitre.mapped",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    licenseState,
                    details: mitreMapping
                });
            }
            if (isMismatch) {
                this.recordEvent({
                    type: "replay.mismatch",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: {
                        expectedReplayRoot,
                        actualReplayRoot
                    }
                });
                this.recordEvent({
                    type: "mutation.detected",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: {
                        reason: "expected replay root does not match actual replay root"
                    }
                });
                this.recordEvent({
                    type: "trust.escalated",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: {
                        from: "T1",
                        to: trust.currentTier,
                        riskScore: trust.riskScore,
                        reason: trust.reason
                    }
                });
                if (trust.privilegeEscalationGate) {
                    this.recordEvent({
                        type: "privilege.escalation.gated",
                        timestamp: new Date().toISOString(),
                        requestId,
                        replayRoot: actualReplayRoot,
                        trustLevel: context.trustLevel,
                        status: context.status,
                        clientIdentity,
                        details: {
                            currentTier: trust.currentTier,
                            riskScore: trust.riskScore
                        }
                    });
                }
                if (trust.approvalRequired) {
                    this.recordEvent({
                        type: "approval.required",
                        timestamp: new Date().toISOString(),
                        requestId,
                        replayRoot: actualReplayRoot,
                        trustLevel: context.trustLevel,
                        status: context.status,
                        clientIdentity,
                        details: {
                            currentTier: trust.currentTier,
                            riskScore: trust.riskScore
                        }
                    });
                }
                this.recordEvent({
                    type: "quarantine.created",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: {
                        quarantineId,
                        reason: "replay root mismatch"
                    }
                });
                this.recordEvent({
                    type: "containment.activated",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
                    clientIdentity,
                    details: {
                        mode: context.containment.mode,
                        executionAllowed: context.containment.executionAllowed
                    }
                });
                if (this.options.failClosed) {
                    this.recordEvent({
                        type: "execution.blocked",
                        timestamp: new Date().toISOString(),
                        requestId,
                        replayRoot: actualReplayRoot,
                        trustLevel: context.trustLevel,
                        status: context.status,
                        clientIdentity,
                        details: {
                            reason: "SCORP LOCK fail-closed containment"
                        }
                    });
                    res.status?.(409);
                    res.json?.({
                        ok: false,
                        error: "EGA_CONTAINMENT_ACTIVATED",
                        message: "Replay mismatch detected. Trust escalated and execution blocked by EGA V9.",
                        ega: context,
                        events: this.events(),
                        eventSummary: this.eventSummary()
                    });
                    return;
                }
            }
            else {
                this.recordEvent({
                    type: "hash.verified",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: "verified",
                    clientIdentity,
                    licenseState
                });
                this.recordEvent({
                    type: "workflow.verified",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: "verified",
                    clientIdentity,
                    licenseState
                });
            }
            next();
        };
    }
    events(type) {
        const events = type ? this.eventLog.filter((event) => event.type === type) : this.eventLog;
        return [...events];
    }
    latestEvents(limit = 20) {
        return this.eventLog.slice(-limit);
    }
    eventSummary() {
        const byType = {};
        for (const event of this.eventLog) {
            byType[event.type] = (byType[event.type] ?? 0) + 1;
        }
        return {
            total: this.eventLog.length,
            byType,
            latest: this.eventLog[this.eventLog.length - 1]
        };
    }
    explain(context) {
        return context?.provenance;
    }
    canonicalize(input) {
        return stableStringify(input);
    }
    replayRoot(input) {
        return (0, crypto_1.createHash)("sha256").update(this.canonicalize(input)).digest("hex");
    }
    detect(input, expectedReplayRoot) {
        const actualReplayRoot = this.replayRoot(input);
        const mismatch = typeof expectedReplayRoot === "string" &&
            expectedReplayRoot.length > 0 &&
            expectedReplayRoot !== actualReplayRoot;
        return {
            status: mismatch ? "mismatch" : "match",
            expectedReplayRoot,
            actualReplayRoot
        };
    }
    createReplayRoot(req) {
        return this.replayRoot({
            appName: this.options.appName,
            method: req.method ?? "UNKNOWN",
            path: req.originalUrl ?? req.url ?? req.path ?? "/",
            body: req.body ?? null,
            query: req.query ?? null,
            params: req.params ?? null
        });
    }
    buildProvenanceGraph(args) {
        const inputId = `input_${args.requestId}`;
        const toolOutputId = `tool_output_${args.requestId}`;
        const policyId = `policy_${args.requestId}`;
        const decisionId = `decision_${args.requestId}`;
        const businessId = `business_metrics_${args.requestId}`;
        const trustId = `trust_escalation_${args.requestId}`;
        const nodes = [
            {
                id: inputId,
                type: "input",
                label: "Input",
                data: {
                    body: args.req.body ?? null,
                    query: args.req.query ?? null,
                    params: args.req.params ?? null
                }
            },
            {
                id: toolOutputId,
                type: "tool_output",
                label: "Tool Output",
                data: {
                    replayRoot: args.replayRoot,
                    hashVerified: !args.isMismatch
                }
            },
            {
                id: policyId,
                type: "policy",
                label: "Policy",
                data: {
                    policyId: this.options.policyId,
                    scorpLock: true,
                    failClosed: this.options.failClosed
                }
            },
            {
                id: decisionId,
                type: "decision",
                label: "Decision",
                data: {
                    status: args.isMismatch ? "contained" : "verified",
                    executionAllowed: !args.isMismatch || !this.options.failClosed
                }
            },
            {
                id: businessId,
                type: "business_metrics",
                label: "Business Metrics",
                data: args.businessMetrics
            },
            {
                id: trustId,
                type: "trust_escalation",
                label: "Trust Escalation",
                data: args.businessGovernanceProfile.trust
            }
        ];
        const edges = [
            { from: inputId, to: toolOutputId, label: "produces" },
            { from: toolOutputId, to: policyId, label: "evaluated by" },
            { from: policyId, to: decisionId, label: "governs" },
            { from: inputId, to: businessId, label: "metrics extracted from" },
            { from: businessId, to: trustId, label: "contributes to" },
            { from: trustId, to: decisionId, label: "escalates" }
        ];
        return {
            graphId: `graph_${args.requestId}`,
            lineage: ["Decision", "Policy", "Tool Output", "Input"],
            nodes,
            edges,
            businessMetrics: args.businessMetrics,
            businessGovernanceProfile: args.businessGovernanceProfile
        };
    }
    getExpectedReplayRoot(req) {
        const headers = req.headers ?? {};
        const value = headers["x-ega-expected-replay-root"] ??
            headers["X-EGA-Expected-Replay-Root"];
        return typeof value === "string" ? value : undefined;
    }
    recordEvent(event) {
        const recordedEvent = {
            ...event,
            id: (0, crypto_1.randomUUID)(),
            sequence: ++this.eventSequence
        };
        this.eventLog.push(recordedEvent);
        if (this.eventLog.length > 1000) {
            this.eventLog.shift();
        }
    }
}
exports.EGA = EGA;
function buildAnonymousClientIdentity(req, appName) {
    const headers = req.headers ?? {};
    const hostValue = headers.host ?? headers.Host;
    const originValue = headers.origin ?? headers.Origin;
    const userAgentValue = headers["user-agent"] ?? headers["User-Agent"];
    const domainHint = typeof hostValue === "string" ? hostValue :
        typeof originValue === "string" ? originValue :
            undefined;
    const source = domainHint ? "host-header" : "unknown";
    const fingerprintInput = stableStringify({
        appName,
        domainHint: domainHint ?? "unknown",
        userAgent: typeof userAgentValue === "string" ? userAgentValue : "unknown"
    });
    const anonymousClientId = `client_${(0, crypto_1.createHash)("sha256")
        .update(fingerprintInput)
        .digest("hex")
        .slice(0, 24)}`;
    return {
        anonymousClientId,
        source,
        domainHint
    };
}
function mapMitreAtlas(req, isMismatch) {
    const body = req.body;
    const headers = req.headers ?? {};
    const promptLike = typeof body?.prompt === "string" ||
        typeof body?.instruction === "string" ||
        typeof headers["x-ega-attack-type"] === "string";
    const toolLike = typeof body?.tool === "string" ||
        typeof body?.toolName === "string" ||
        typeof body?.tool_output !== "undefined" ||
        typeof body?.toolOutput !== "undefined";
    const unauthorizedTool = body?.unauthorized === true ||
        headers["x-ega-attack-type"] === "unauthorized-tool-invocation";
    if (unauthorizedTool && isMismatch) {
        return {
            mapped: true,
            attackType: "Unauthorized Tool Invocation",
            atlasTechnique: "ATLAS: Unauthorized Tool Invocation",
            attackTechnique: "ATT&CK-style: Execution / Abuse of Tool Invocation",
            severity: "critical",
            reason: "Unauthorized tool invocation combined with replay mismatch."
        };
    }
    if (toolLike && isMismatch) {
        return {
            mapped: true,
            attackType: "Tool Response Manipulation",
            atlasTechnique: "ATLAS: Tool Response Manipulation",
            attackTechnique: "ATT&CK-style: Data Manipulation / Tool Output Tampering",
            severity: "high",
            reason: "Tool-like payload produced replay mismatch."
        };
    }
    if (promptLike && isMismatch) {
        return {
            mapped: true,
            attackType: "Prompt Injection",
            atlasTechnique: "ATLAS: Prompt Injection",
            attackTechnique: "ATT&CK-style: Input Manipulation",
            severity: "high",
            reason: "Prompt-like payload produced replay mismatch."
        };
    }
    if (isMismatch) {
        return {
            mapped: true,
            attackType: "Replay Root Tampering",
            atlasTechnique: "ATLAS: Replay Root Tampering",
            attackTechnique: "ATT&CK-style: Integrity Violation",
            severity: "high",
            reason: "Expected replay root does not match actual replay root."
        };
    }
    return {
        mapped: false,
        attackType: "None",
        atlasTechnique: "none",
        attackTechnique: "none",
        severity: "none",
        reason: "No replay mismatch detected."
    };
}
function evaluateLicenseState(req) {
    const headers = req.headers ?? {};
    const modeHeader = headers["x-ega-license-mode"];
    const statusHeader = headers["x-ega-license-status"];
    if (modeHeader === "enterprise" && statusHeader === "suspended") {
        return {
            mode: "enterprise",
            status: "suspended",
            enforcement: "observe",
            reason: "Enterprise license is suspended. V9 Alpha records state but does not enforce remote blocking."
        };
    }
    return {
        mode: "alpha",
        status: "active",
        enforcement: "disabled",
        reason: "V9 Alpha local runtime. License enforcement disabled."
    };
}
function evaluateTrust(args) {
    let riskScore = 10;
    if (args.isMismatch)
        riskScore += 60;
    if (args.failClosed && args.isMismatch)
        riskScore += 15;
    if ((args.businessMetrics.estimatedTransactionValue ?? 0) >= 500)
        riskScore += 10;
    riskScore = Math.min(100, riskScore);
    const currentTier = riskScore >= 90 ? "T4" :
        riskScore >= 70 ? "T3" :
            riskScore >= 40 ? "T2" :
                "T1";
    return {
        currentTier,
        riskScore,
        approvalRequired: riskScore >= args.approvalThreshold,
        privilegeEscalationGate: currentTier === "T3" || currentTier === "T4",
        reason: args.isMismatch
            ? "Replay mismatch increased governance risk."
            : "Replay verified within normal governance range."
    };
}
function buildBusinessGovernanceProfile(metrics, trust) {
    return {
        metrics,
        trust
    };
}
function collectBusinessMetrics(input) {
    if (input === null || typeof input !== "object") {
        return { detected: false };
    }
    const obj = input;
    const amount = numberFrom(obj.amount);
    const price = numberFrom(obj.price);
    const quantity = numberFrom(obj.quantity);
    const currency = typeof obj.currency === "string" ? obj.currency : undefined;
    const estimatedTransactionValue = amount ??
        (price !== undefined && quantity !== undefined ? price * quantity : undefined);
    return {
        detected: amount !== undefined ||
            price !== undefined ||
            quantity !== undefined ||
            currency !== undefined,
        amount,
        price,
        quantity,
        currency,
        estimatedTransactionValue
    };
}
function numberFrom(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
function stableStringify(input) {
    if (input === null || typeof input !== "object") {
        return JSON.stringify(input);
    }
    if (Array.isArray(input)) {
        return `[${input.map(stableStringify).join(",")}]`;
    }
    const obj = input;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => {
        return `${JSON.stringify(key)}:${stableStringify(obj[key])}`;
    }).join(",")}}`;
}
function verifyExecution(input) {
    const ega = EGA.init();
    const replayRoot = ega.replayRoot(input);
    const businessMetrics = collectBusinessMetrics(input);
    const trust = evaluateTrust({
        isMismatch: false,
        failClosed: true,
        businessMetrics,
        approvalThreshold: 70
    });
    const businessGovernanceProfile = buildBusinessGovernanceProfile(businessMetrics, trust);
    const clientIdentity = {
        anonymousClientId: "client_standalone",
        source: "unknown"
    };
    const licenseState = {
        mode: "alpha",
        status: "active",
        enforcement: "disabled",
        reason: "Standalone verification runtime."
    };
    const mitreMapping = {
        mapped: false,
        attackType: "None",
        atlasTechnique: "none",
        attackTechnique: "none",
        severity: "none",
        reason: "Standalone verification runtime."
    };
    return {
        requestId: (0, crypto_1.randomUUID)(),
        replayRoot,
        trustLevel: "supported",
        status: "verified",
        scorpLock: true,
        clientIdentity,
        licenseState,
        mitreMapping,
        detection: {
            status: "match",
            actualReplayRoot: replayRoot
        },
        containment: {
            activated: false,
            mode: "fail-closed",
            executionAllowed: true
        },
        trust,
        businessGovernanceProfile,
        provenance: {
            graphId: "standalone_graph",
            lineage: ["Decision", "Policy", "Tool Output", "Input"],
            nodes: [],
            edges: [],
            businessMetrics,
            businessGovernanceProfile
        }
    };
}
function replay(input) {
    return verifyExecution(input);
}
function provenance(input) {
    return verifyExecution(input);
}
function contain(input) {
    return verifyExecution(input);
}
function guardLatencyMicroseconds(startedAt) {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    return Number(elapsedNanoseconds) / 1000;
}
function resolveGuardWorkflow(req, resolver) {
    if (resolver) {
        return resolver(req);
    }
    if (req.egaWorkflow !== undefined) {
        return req.egaWorkflow;
    }
    if (req.body !== null &&
        typeof req.body === "object" &&
        "workflow" in req.body) {
        return req.body.workflow;
    }
    return req.body;
}
function buildGuardDecision(verification, startedAt) {
    return {
        verified: verification.status === "verified" &&
            verification.detection.status === "match" &&
            verification.containment.executionAllowed,
        containmentRequired: verification.containment.activated &&
            !verification.containment.executionAllowed,
        executionAllowed: verification.containment.executionAllowed,
        trustState: verification.trust.currentTier,
        reason: verification.containment.reason ?? null,
        latencyMicroseconds: guardLatencyMicroseconds(startedAt),
        verification
    };
}
class EGAGuardInputError extends Error {
    constructor(code, message, statusCode = 400) {
        super(message);
        this.name = "EGAGuardInputError";
        this.code = code;
        this.statusCode = statusCode;
    }
}
function isWorkflowStep(value) {
    if (value === null ||
        typeof value !== "object" ||
        Array.isArray(value)) {
        return false;
    }
    const step = value;
    return (typeof step.action === "string" &&
        step.action.trim().length > 0);
}
function validateGuardWorkflow(workflow) {
    if (workflow === undefined || workflow === null) {
        throw new EGAGuardInputError("EGA_WORKFLOW_REQUIRED", "A governable workflow is required.");
    }
    if (Array.isArray(workflow)) {
        if (workflow.length === 0) {
            throw new EGAGuardInputError("EGA_INVALID_WORKFLOW", "Workflow must contain at least one step.");
        }
        if (!workflow.every(isWorkflowStep)) {
            throw new EGAGuardInputError("EGA_INVALID_WORKFLOW", "Every workflow step must be an object with a non-empty action.");
        }
        return;
    }
    if (typeof workflow === "object" &&
        !Array.isArray(workflow)) {
        const candidate = workflow;
        if (Array.isArray(candidate.steps) &&
            candidate.steps.length > 0 &&
            candidate.steps.every(isWorkflowStep)) {
            return;
        }
        if (isWorkflowStep(candidate)) {
            return;
        }
    }
    throw new EGAGuardInputError("EGA_INVALID_WORKFLOW", "Workflow must be a valid action, step array, or object containing steps.");
}
function createGuard(options = {}) {
    const mode = options.mode ?? "fail-closed";
    const blockStatusCode = options.statusCode ?? 403;
    const policyId = options.policyId ?? "default-policy";
    const invalidPolicy = typeof policyId !== "string" ||
        policyId.trim().length === 0;
    const engine = EGA.init({
        failClosed: mode === "fail-closed",
        policyId: invalidPolicy
            ? "invalid-policy"
            : policyId.trim()
    });
    const engineMiddleware = engine.guard();
    return async (req, res, next) => {
        const startedAt = process.hrtime.bigint();
        try {
            if (invalidPolicy) {
                throw new EGAGuardInputError("EGA_INVALID_POLICY", "policyId must be a non-empty string.");
            }
            const workflow = await resolveGuardWorkflow(req, options.resolveWorkflow);
            validateGuardWorkflow(workflow);
            const governedRequest = {
                method: req.method,
                originalUrl: req.originalUrl,
                url: req.url,
                path: req.path,
                body: workflow,
                query: req.query,
                params: req.params,
                headers: req.headers,
                ega: req.ega,
                egaDecision: req.egaDecision
            };
            const originalStatus = res.status?.bind(res);
            const originalJson = res.json?.bind(res);
            let decisionDelivered = false;
            const deliverDecision = async (decision) => {
                if (decisionDelivered) {
                    return;
                }
                decisionDelivered = true;
                req.ega = decision.verification;
                req.egaDecision = decision;
                res.setHeader?.("x-ega-latency-microseconds", String(decision.latencyMicroseconds));
                if (decision.verification.containment.activated) {
                    await options.onContained?.(decision);
                }
                else {
                    await options.onVerified?.(decision);
                }
            };
            const responseProxy = {
                ...res,
                setHeader(name, value) {
                    res.setHeader?.(name, value);
                },
                status(code) {
                    const finalCode = code === 409 && mode === "fail-closed"
                        ? blockStatusCode
                        : code;
                    if (originalStatus) {
                        originalStatus(finalCode);
                    }
                    else {
                        res.statusCode = finalCode;
                    }
                    return responseProxy;
                },
                json(body) {
                    const verification = governedRequest.ega;
                    if (!verification) {
                        originalJson?.(body);
                        return;
                    }
                    const decision = buildGuardDecision(verification, startedAt);
                    void deliverDecision(decision).then(() => {
                        if (body !== null &&
                            typeof body === "object" &&
                            !Array.isArray(body)) {
                            originalJson?.({
                                ...body,
                                decision
                            });
                            return;
                        }
                        originalJson?.({
                            body,
                            decision
                        });
                    });
                }
            };
            const guardedNext = (error) => {
                if (error !== undefined) {
                    next(error);
                    return;
                }
                const verification = governedRequest.ega;
                if (!verification) {
                    next(new Error("EGA guard completed without verification evidence."));
                    return;
                }
                const decision = buildGuardDecision(verification, startedAt);
                void deliverDecision(decision)
                    .then(() => next())
                    .catch((callbackError) => next(callbackError));
            };
            engineMiddleware(governedRequest, responseProxy, guardedNext);
        }
        catch (error) {
            const latencyMicroseconds = guardLatencyMicroseconds(startedAt);
            res.setHeader?.("x-ega-latency-microseconds", String(latencyMicroseconds));
            const isInputError = error instanceof EGAGuardInputError;
            const statusCode = isInputError
                ? error.statusCode
                : 500;
            const errorCode = isInputError
                ? error.code
                : "EGA_GUARD_FAILURE";
            if (res.status) {
                res.status(statusCode);
            }
            else {
                res.statusCode = statusCode;
            }
            res.json?.({
                ok: false,
                error: errorCode,
                message: error instanceof Error
                    ? error.message
                    : "Unknown EGA guard failure.",
                containmentRequired: true,
                executionAllowed: false,
                latencyMicroseconds
            });
        }
    };
}
exports.ega = Object.freeze({
    guard: createGuard
});
