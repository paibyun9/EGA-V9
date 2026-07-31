"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createLicenseApiClient,
  EGALicenseApiError
} = require(
  "../../dist/cli/license-api-client.js"
);

test(
  "returns an Evaluation License Key from a successful response",
  async () => {
    const client =
      createLicenseApiClient({
        baseUrl:
          "https://license.example.com",
        fetchImplementation:
          async () =>
            new Response(
              JSON.stringify({
                evaluationLicenseKey:
                  "EGA9-LIC-V1.payload.signature"
              }),
              {
                status: 201,
                headers: {
                  "content-type":
                    "application/json"
                }
              }
            )
      });

    const result =
      await client
        .issueEvaluationLicense({
          contactName:
            "Test User",
          companyName:
            "Test Company",
          workEmail:
            "test@example.com"
        });

    assert.equal(
      result.evaluationLicenseKey,
      "EGA9-LIC-V1.payload.signature"
    );
  }
);

test(
  "rejects non-HTTPS remote API URLs",
  () => {
    assert.throws(
      () =>
        createLicenseApiClient({
          baseUrl:
            "http://license.example.com"
        }),
      error =>
        error instanceof
          EGALicenseApiError &&
        error.code ===
          "EGA_LICENSE_API_CONFIG"
    );
  }
);

test(
  "permits HTTP localhost development",
  () => {
    assert.doesNotThrow(
      () =>
        createLicenseApiClient({
          baseUrl:
            "http://127.0.0.1:8787"
        })
    );
  }
);

test(
  "surfaces remote License API errors",
  async () => {
    const client =
      createLicenseApiClient({
        baseUrl:
          "https://license.example.com",
        fetchImplementation:
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  code:
                    "EGA_LICENSE_REQUEST_INVALID",
                  message:
                    "Work Email is invalid."
                }
              }),
              {
                status: 400,
                headers: {
                  "content-type":
                    "application/json"
                }
              }
            )
      });

    await assert.rejects(
      () =>
        client
          .issueEvaluationLicense({
            contactName:
              "Test User",
            companyName:
              "Test Company",
            workEmail:
              "invalid-email"
          }),
      error =>
        error instanceof
          EGALicenseApiError &&
        error.code ===
          "EGA_LICENSE_API_RESPONSE" &&
        error.statusCode === 400 &&
        error.remoteCode ===
          "EGA_LICENSE_REQUEST_INVALID"
    );
  }
);
