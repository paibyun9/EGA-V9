"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createUsageReporter,
  EGAUsageReporterError
} = require(
  "../../dist/license/usage-reporter.js"
);

test(
  "sends only the approved Usage Event fields",
  async () => {
    let capturedRequest;

    const reporter =
      createUsageReporter({
        apiBaseUrl:
          "https://usage.example.com",

        sdkVersion:
          "1.0.1",

        readLicenseKey:
          () =>
            "EGA9-LIC-V1.payload.signature",

        fetchImplementation:
          async (
            url,
            options
          ) => {
            capturedRequest = {
              url,
              options
            };

            return new Response(
              JSON.stringify({
                status:
                  "recorded",
                eventId:
                  "event-test-001"
              }),
              {
                status: 201,
                headers: {
                  "content-type":
                    "application/json"
                }
              }
            );
          }
      });

    const result =
      await reporter
        .recordGovernedExecution({
          eventId:
            "event-test-001",

          occurredAt:
            new Date(
              "2026-08-01T00:00:00.000Z"
            ),

          environment:
            "production",

          riskLevel:
            "high-risk",

          executionResult:
            "contain"
        });

    assert.equal(
      result.status,
      "recorded"
    );

    const body =
      JSON.parse(
        capturedRequest
          .options.body
      );

    assert.deepEqual(
      Object.keys(body).sort(),
      [
        "environment",
        "eventId",
        "executionResult",
        "occurredAt",
        "riskLevel",
        "sdkVersion"
      ].sort()
    );

    assert.equal(
      "prompt" in body,
      false
    );

    assert.equal(
      "toolArguments" in body,
      false
    );

    assert.equal(
      "executionPayload" in body,
      false
    );
  }
);

test(
  "fails when no Evaluation License Key is stored",
  async () => {
    const reporter =
      createUsageReporter({
        apiBaseUrl:
          "https://usage.example.com",

        readLicenseKey:
          () => null,

        fetchImplementation:
          async () => {
            throw new Error(
              "must not be called"
            );
          }
      });

    await assert.rejects(
      () =>
        reporter
          .recordGovernedExecution({
            environment:
              "production",

            riskLevel:
              "standard",

            executionResult:
              "allow"
          }),
      error =>
        error instanceof
          EGAUsageReporterError &&
        error.code ===
          "EGA_USAGE_REPORTER_LICENSE"
    );
  }
);
