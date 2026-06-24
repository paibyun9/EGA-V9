import { createHash, randomUUID } from "crypto";

export type EGATrustLevel = "supported" | "verified";
export type EGAStatus = "verified" | "contained" | "failed";
export type EGADetectionStatus = "match" | "mismatch";
export type EGAContainmentMode = "observe" | "fail-closed";

export type EGAEventType =
  | "workflow.started"
  | "workflow.verified"
  | "replay.mismatch"
  | "hash.verified"
  | "mutation.detected"
  | "containment.activated"
  | "execution.blocked"
  | "quarantine.created";

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

export class EGA {
  private readonly options: Required<EGAOptions>;
  private readonly eventLog: EGAEvent[] = [];

  private constructor(options: EGAOptions = {}) {
    this.options = {
      appName: options.appName ?? "ega-v9-app",
      trustLevel: options.trustLevel ?? "supported",
      telemetry: options.telemetry ?? false,
      failClosed: options.failClosed ?? true
    };
  }

  static init(options: EGAOptions = {}): EGA {
    return new EGA(options);
  }

  guard() {
    return (req: EGARequest, res: EGAResponse, next: NextFunction) => {
      const requestId = randomUUID();
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

      const isMismatch =
        typeof expectedReplayRoot === "string" &&
        expectedReplayRoot.length > 0 &&
        expectedReplayRoot !== actualReplayRoot;

      const quarantineId = isMismatch ? `q_${requestId}` : undefined;

      const context: EGARequestContext = {
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
      } else {
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

  events(): EGAEvent[] {
    return [...this.eventLog];
  }

  canonicalize(input: unknown): string {
    return stableStringify(input);
  }

  replayRoot(input: unknown): string {
    return createHash("sha256").update(this.canonicalize(input)).digest("hex");
  }

  detect(input: unknown, expectedReplayRoot?: string) {
    const actualReplayRoot = this.replayRoot(input);
    const mismatch =
      typeof expectedReplayRoot === "string" &&
      expectedReplayRoot.length > 0 &&
      expectedReplayRoot !== actualReplayRoot;

    return {
      status: mismatch ? "mismatch" as const : "match" as const,
      expectedReplayRoot,
      actualReplayRoot
    };
  }

  private createReplayRoot(req: EGARequest): string {
    return this.replayRoot({
      appName: this.options.appName,
      method: req.method ?? "UNKNOWN",
      path: req.originalUrl ?? req.url ?? req.path ?? "/",
      body: req.body ?? null,
      query: req.query ?? null,
      params: req.params ?? null
    });
  }

  private getExpectedReplayRoot(req: EGARequest): string | undefined {
    const headers = req.headers ?? {};
    const value =
      headers["x-ega-expected-replay-root"] ??
      headers["X-EGA-Expected-Replay-Root"];

    return typeof value === "string" ? value : undefined;
  }

  private recordEvent(event: EGAEvent): void {
    this.eventLog.push(event);

    if (this.eventLog.length > 1000) {
      this.eventLog.shift();
    }
  }
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map(stableStringify).join(",")}]`;
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();

  return `{${keys.map((key) => {
    return `${JSON.stringify(key)}:${stableStringify(obj[key])}`;
  }).join(",")}}`;
}

export function verifyExecution(input: unknown): EGARequestContext {
  const ega = EGA.init();
  const replayRoot = ega.replayRoot(input);

  return {
    requestId: randomUUID(),
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

export function replay(input: unknown): EGARequestContext {
  return verifyExecution(input);
}

export function provenance(input: unknown): EGARequestContext {
  return verifyExecution(input);
}

export function contain(input: unknown): EGARequestContext {
  return verifyExecution(input);
}
