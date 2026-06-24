"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGA = void 0;
exports.verifyExecution = verifyExecution;
exports.replay = replay;
exports.provenance = provenance;
exports.contain = contain;
const crypto_1 = require("crypto");
class EGA {
    constructor(options = {}) {
        this.eventLog = [];
        this.options = {
            appName: options.appName ?? "ega-v9-app",
            trustLevel: options.trustLevel ?? "supported",
            telemetry: options.telemetry ?? false,
            failClosed: options.failClosed ?? true
        };
    }
    static init(options = {}) {
        return new EGA(options);
    }
    guard() {
        return (req, res, next) => {
            const requestId = (0, crypto_1.randomUUID)();
            const actualReplayRoot = this.createReplayRoot(req);
            const expectedReplayRoot = this.getExpectedReplayRoot(req);
            this.recordEvent({
                type: "workflow.started",
                timestamp: new Date().toISOString(),
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: this.options.trustLevel,
                status: "verified"
            });
            const isMismatch = typeof expectedReplayRoot === "string" &&
                expectedReplayRoot.length > 0 &&
                expectedReplayRoot !== actualReplayRoot;
            const quarantineId = isMismatch ? `q_${requestId}` : undefined;
            const context = {
                requestId,
                replayRoot: actualReplayRoot,
                trustLevel: this.options.trustLevel,
                status: isMismatch ? "contained" : "verified",
                scorpLock: true,
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
                }
            };
            req.ega = context;
            res.setHeader?.("x-ega-request-id", requestId);
            res.setHeader?.("x-ega-replay-root", actualReplayRoot);
            res.setHeader?.("x-ega-trust-level", context.trustLevel);
            res.setHeader?.("x-ega-scorp-lock", "true");
            res.setHeader?.("x-ega-detection", context.detection.status);
            res.setHeader?.("x-ega-containment", context.containment.activated ? "activated" : "inactive");
            res.setHeader?.("x-ega-execution-allowed", String(context.containment.executionAllowed));
            if (isMismatch) {
                this.recordEvent({
                    type: "replay.mismatch",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
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
                    details: {
                        reason: "expected replay root does not match actual replay root"
                    }
                });
                this.recordEvent({
                    type: "quarantine.created",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: context.status,
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
                        details: {
                            reason: "SCORP LOCK fail-closed containment"
                        }
                    });
                    res.status?.(409);
                    res.json?.({
                        ok: false,
                        error: "EGA_CONTAINMENT_ACTIVATED",
                        message: "Replay mismatch detected. Execution blocked by EGA V9 fail-closed containment.",
                        ega: context,
                        events: this.events()
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
                    status: "verified"
                });
                this.recordEvent({
                    type: "workflow.verified",
                    timestamp: new Date().toISOString(),
                    requestId,
                    replayRoot: actualReplayRoot,
                    trustLevel: context.trustLevel,
                    status: "verified"
                });
            }
            next();
        };
    }
    events() {
        return [...this.eventLog];
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
    getExpectedReplayRoot(req) {
        const headers = req.headers ?? {};
        const value = headers["x-ega-expected-replay-root"] ??
            headers["X-EGA-Expected-Replay-Root"];
        return typeof value === "string" ? value : undefined;
    }
    recordEvent(event) {
        this.eventLog.push(event);
        if (this.eventLog.length > 1000) {
            this.eventLog.shift();
        }
    }
}
exports.EGA = EGA;
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
    return {
        requestId: (0, crypto_1.randomUUID)(),
        replayRoot,
        trustLevel: "supported",
        status: "verified",
        scorpLock: true,
        detection: {
            status: "match",
            actualReplayRoot: replayRoot
        },
        containment: {
            activated: false,
            mode: "fail-closed",
            executionAllowed: true
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
