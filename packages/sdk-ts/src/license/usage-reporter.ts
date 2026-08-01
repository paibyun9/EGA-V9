import {
  randomUUID
} from "crypto";

import {
  readEvaluationLicenseKey
} from "./license-store";

export type EGAUsageEnvironment =
  | "development"
  | "production";

export type EGAUsageRiskLevel =
  | "standard"
  | "high-risk";

export type EGAUsageExecutionResult =
  | "allow"
  | "deny"
  | "contain";

export type EGAUsageEventInput = {
  environment:
    EGAUsageEnvironment;

  riskLevel:
    EGAUsageRiskLevel;

  executionResult:
    EGAUsageExecutionResult;

  occurredAt?: Date;

  eventId?: string;
};

export type EGAUsageReporterOptions = {
  apiBaseUrl: string;

  sdkVersion?: string;

  timeoutMilliseconds?: number;

  fetchImplementation?: typeof fetch;

  readLicenseKey?: () =>
    string | null;
};

export class EGAUsageReporterError
  extends Error {
  readonly code:
    | "EGA_USAGE_REPORTER_CONFIG"
    | "EGA_USAGE_REPORTER_LICENSE"
    | "EGA_USAGE_REPORTER_NETWORK"
    | "EGA_USAGE_REPORTER_RESPONSE";

  constructor(
    code:
      EGAUsageReporterError["code"],
    message: string
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "EGAUsageReporterError";

    this.code = code;

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function normalizeBaseUrl(
  value: string
): string {
  let url: URL;

  try {
    url = new URL(
      value.trim()
    );
  } catch {
    throw new EGAUsageReporterError(
      "EGA_USAGE_REPORTER_CONFIG",
      "Usage API base URL is invalid."
    );
  }

  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      (
        url.hostname ===
          "127.0.0.1" ||
        url.hostname ===
          "localhost"
      )
    )
  ) {
    throw new EGAUsageReporterError(
      "EGA_USAGE_REPORTER_CONFIG",
      "Usage API must use HTTPS except for localhost development."
    );
  }

  return url
    .toString()
    .replace(/\/$/, "");
}

export function createUsageReporter(
  options:
    EGAUsageReporterOptions
) {
  const baseUrl =
    normalizeBaseUrl(
      options.apiBaseUrl
    );

  const fetchImplementation =
    options.fetchImplementation ??
    fetch;

  const readLicenseKey =
    options.readLicenseKey ??
    (() =>
      readEvaluationLicenseKey());

  const timeoutMilliseconds =
    options.timeoutMilliseconds ??
    5_000;

  const sdkVersion =
    options.sdkVersion ??
    "1.0.1";

  return {
    async recordGovernedExecution(
      input:
        EGAUsageEventInput
    ): Promise<{
      status:
        | "recorded"
        | "duplicate";
      eventId: string;
    }> {
      const evaluationLicenseKey =
        readLicenseKey();

      if (!evaluationLicenseKey) {
        throw new EGAUsageReporterError(
          "EGA_USAGE_REPORTER_LICENSE",
          "No Evaluation License Key is stored."
        );
      }

      const eventId =
        input.eventId ??
        randomUUID();

      const occurredAt =
        input.occurredAt ??
        new Date();

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          timeoutMilliseconds
        );

      try {
        let response:
          Response;

        try {
          response =
            await fetchImplementation(
              `${baseUrl}/api/usage/events`,
              {
                method: "POST",

                headers: {
                  "content-type":
                    "application/json",

                  accept:
                    "application/json",

                  authorization:
                    `Bearer ${evaluationLicenseKey}`
                },

                body:
                  JSON.stringify({
                    eventId,

                    occurredAt:
                      occurredAt
                        .toISOString(),

                    environment:
                      input.environment,

                    riskLevel:
                      input.riskLevel,

                    executionResult:
                      input.executionResult,

                    sdkVersion
                  }),

                signal:
                  controller.signal
              }
            );
        } catch (error) {
          throw new EGAUsageReporterError(
            "EGA_USAGE_REPORTER_NETWORK",
            error instanceof Error
              ? error.message
              : "Unable to send Usage Event."
          );
        }

        let body:
          unknown;

        try {
          body =
            await response.json();
        } catch {
          throw new EGAUsageReporterError(
            "EGA_USAGE_REPORTER_RESPONSE",
            "Usage API returned invalid JSON."
          );
        }

        if (!response.ok) {
          const remote =
            body as {
              error?: {
                code?: string;
                message?: string;
              };
            };

          throw new EGAUsageReporterError(
            "EGA_USAGE_REPORTER_RESPONSE",
            remote.error?.message ??
              "Usage API rejected the event."
          );
        }

        const result =
          body as {
            status?: unknown;
            eventId?: unknown;
          };

        if (
          (
            result.status !==
              "recorded" &&
            result.status !==
              "duplicate"
          ) ||
          typeof result.eventId !==
            "string"
        ) {
          throw new EGAUsageReporterError(
            "EGA_USAGE_REPORTER_RESPONSE",
            "Usage API response is invalid."
          );
        }

        return {
          status:
            result.status,
          eventId:
            result.eventId
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
