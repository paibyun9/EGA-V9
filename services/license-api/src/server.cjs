"use strict";

const http = require("node:http");

const {
  createPrivateKey
} = require("node:crypto");

const {
  EvaluationLicenseServiceError,
  issueEvaluationLicense
} = require(
  "./evaluation-license-service.cjs"
);

const {
  createFileLicenseRegistry
} = require(
  "./license-registry.cjs"
);

const {
  createFileCompanyUsageMeter
} = require(
  "./company-usage-meter.cjs"
);

const {
  createUsageEventHandler
} = require(
  "./usage-event-handler.cjs"
);

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 16 * 1024;

function sendJson(
  response,
  statusCode,
  body
) {
  const payload =
    JSON.stringify(body);

  response.writeHead(
    statusCode,
    {
      "content-type":
        "application/json; charset=utf-8",
      "content-length":
        Buffer.byteLength(payload),
      "cache-control":
        "no-store",
      "x-content-type-options":
        "nosniff"
    }
  );

  response.end(payload);
}

function readJsonBody(request) {
  return new Promise(
    (resolve, reject) => {
      const chunks = [];
      let totalBytes = 0;

      request.on(
        "data",
        chunk => {
          totalBytes += chunk.length;

          if (
            totalBytes >
            MAX_BODY_BYTES
          ) {
            reject(
              Object.assign(
                new Error(
                  "Request body is too large."
                ),
                {
                  statusCode: 413,
                  code:
                    "EGA_LICENSE_REQUEST_TOO_LARGE"
                }
              )
            );

            request.destroy();
            return;
          }

          chunks.push(chunk);
        }
      );

      request.on(
        "end",
        () => {
          try {
            const text =
              Buffer.concat(chunks)
                .toString("utf8");

            resolve(
              text.length > 0
                ? JSON.parse(text)
                : {}
            );
          } catch {
            reject(
              Object.assign(
                new Error(
                  "Request body must contain valid JSON."
                ),
                {
                  statusCode: 400,
                  code:
                    "EGA_LICENSE_REQUEST_INVALID"
                }
              )
            );
          }
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}

function loadPrivateKey() {
  const privateKeyPem =
    process.env
      .EGA_V9_LICENSE_PRIVATE_KEY_PEM;

  if (!privateKeyPem) {
    return null;
  }

  try {
    return createPrivateKey(
      privateKeyPem
    );
  } catch {
    throw new Error(
      "EGA_V9_LICENSE_PRIVATE_KEY_PEM is not a valid private key."
    );
  }
}

function createLicenseApiServer(options = {}) {
  const privateKey =
    options.privateKey ??
    loadPrivateKey();

  const now =
    options.now;

  const licenseIdFactory =
    options.licenseIdFactory;

  const registry =
    options.registry ??
    createFileLicenseRegistry({
      registryPath:
        options.registryPath
    });

  registry.initialize();

  const usageMeter =
    options.usageMeter ??
    createFileCompanyUsageMeter({
      aggregatePath:
        options.usageAggregatePath,
      eventPath:
        options.usageEventPath
    });

  usageMeter.initialize();

  const usageEventHandler =
    privateKey
      ? createUsageEventHandler({
          registry,
          usageMeter,
          privateKey,
          nowFactory:
            typeof now ===
              "function"
              ? now
              : () => new Date()
        })
      : null;

  return http.createServer(
    async (
      request,
      response
    ) => {
      try {
        const url = new URL(
          request.url ?? "/",
          "http://localhost"
        );

        if (
          request.method === "GET" &&
          url.pathname === "/health"
        ) {
          sendJson(
            response,
            200,
            {
              status: "ok",
              service:
                "ega-v9-license-api",
              signingAvailable:
                Boolean(privateKey)
            }
          );

          return;
        }

        if (
          url.pathname ===
          "/api/usage/events"
        ) {
          if (
            request.method !== "POST"
          ) {
            response.setHeader(
              "allow",
              "POST"
            );

            sendJson(
              response,
              405,
              {
                error: {
                  code:
                    "EGA_USAGE_METHOD_NOT_ALLOWED",
                  message:
                    "Only POST is supported."
                }
              }
            );

            return;
          }

          if (!usageEventHandler) {
            sendJson(
              response,
              503,
              {
                error: {
                  code:
                    "EGA_USAGE_SERVICE_UNAVAILABLE",
                  message:
                    "Company Usage Meter is unavailable."
                }
              }
            );

            return;
          }

          const usageBody =
            await readJsonBody(
              request
            );

          const result =
            usageEventHandler.record(
              request,
              usageBody
            );

          sendJson(
            response,
            result.created
              ? 201
              : 200,
            {
              status:
                result.created
                  ? "recorded"
                  : "duplicate",
              eventId:
                result.eventId
            }
          );

          return;
        }

        if (
          url.pathname !==
          "/api/licenses/evaluation"
        ) {
          sendJson(
            response,
            404,
            {
              error: {
                code:
                  "EGA_LICENSE_NOT_FOUND",
                message:
                  "Endpoint not found."
              }
            }
          );

          return;
        }

        if (
          request.method !== "POST"
        ) {
          response.setHeader(
            "allow",
            "POST"
          );

          sendJson(
            response,
            405,
            {
              error: {
                code:
                  "EGA_LICENSE_METHOD_NOT_ALLOWED",
                message:
                  "Only POST is supported."
              }
            }
          );

          return;
        }

        const contentType =
          String(
            request.headers[
              "content-type"
            ] ?? ""
          );

        if (
          !contentType
            .toLowerCase()
            .startsWith(
              "application/json"
            )
        ) {
          sendJson(
            response,
            400,
            {
              error: {
                code:
                  "EGA_LICENSE_REQUEST_INVALID",
                message:
                  "Content-Type must be application/json."
              }
            }
          );

          return;
        }

        const body =
          await readJsonBody(
            request
          );

        const result =
          issueEvaluationLicense({
            input: body,
            privateKey,
            now:
              typeof now ===
                "function"
                ? now()
                : new Date(),
            licenseIdFactory,
            registry
          });

        sendJson(
          response,
          201,
          {
            evaluationLicenseKey:
              result
                .evaluationLicenseKey,
            licenseId:
              result.license.licenseId,
            issuedAt:
              result.license.issuedAt,
            expiresAt:
              result.license.expiresAt
          }
        );
      } catch (error) {
        const code =
          error instanceof
            EvaluationLicenseServiceError
            ? error.code
            : error?.code ??
              "EGA_LICENSE_SERVER_ERROR";

        const statusCode =
          error?.statusCode ??
          (
            code ===
              "EGA_LICENSE_REQUEST_INVALID"
              ? 400
              : code ===
                "EGA_LICENSE_TRIAL_ALREADY_ISSUED"
                ? 409
                : code ===
                  "EGA_LICENSE_SERVICE_UNAVAILABLE"
                  ? 503
                  : 500
          );

        sendJson(
          response,
          statusCode,
          {
            error: {
              code,
              message:
                error instanceof Error
                  ? error.message
                  : "Unexpected License API error."
            }
          }
        );
      }
    }
  );
}

function startServer() {
  const host =
    process.env.HOST ??
    DEFAULT_HOST;

  const rawPort =
    process.env.PORT ??
    String(DEFAULT_PORT);

  const port =
    Number.parseInt(
      rawPort,
      10
    );

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "PORT must be a valid TCP port."
    );
  }

  const server =
    createLicenseApiServer();

  server.listen(
    port,
    host,
    () => {
      console.log(
        `EGA V9 License API listening on http://${host}:${port}`
      );
    }
  );
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createLicenseApiServer,
  startServer
};
