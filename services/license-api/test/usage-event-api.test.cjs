"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  generateKeyPairSync
} = require("node:crypto");

const {
  mkdtempSync,
  rmSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  issueEvaluationLicenseKey
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

const {
  createLicenseApiServer
} = require(
  "../src/server.cjs"
);

async function startEnvironment() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-usage-api-"
      )
    );

  const {
    privateKey
  } = generateKeyPairSync(
    "ed25519"
  );

  const license = {
    schemaVersion: 1,
    licenseKind:
      "evaluation",
    licenseId:
      "eval_usage_api_001",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    workEmail:
      "test@example.com",
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z"
  };

  const evaluationLicenseKey =
    issueEvaluationLicenseKey(
      license,
      privateKey
    );

  const server =
    createLicenseApiServer({
      privateKey,

      registryPath:
        join(
          directoryPath,
          "registry.json"
        ),

      usageAggregatePath:
        join(
          directoryPath,
          "daily.json"
        ),

      usageEventPath:
        join(
          directoryPath,
          "events.jsonl"
        ),

      now: () =>
        new Date(
          "2026-08-15T00:00:00.000Z"
        )
    });

  const {
    createFileLicenseRegistry
  } = require(
    "../src/license-registry.cjs"
  );

  const registry =
    createFileLicenseRegistry({
      registryPath:
        join(
          directoryPath,
          "registry.json"
        )
    });

  registry.createEvaluationRecord({
    licenseId:
      license.licenseId,
    contactName:
      license.contactName,
    companyName:
      license.companyName,
    workEmail:
      license.workEmail,
    issuedAt:
      license.issuedAt,
    expiresAt:
      license.expiresAt,
    status:
      "active",
    createdAt:
      new Date(
        license.issuedAt
      )
  });

  await new Promise(resolve => {
    server.listen(
      0,
      "127.0.0.1",
      resolve
    );
  });

  const address =
    server.address();

  return {
    directoryPath,
    server,
    evaluationLicenseKey,
    baseUrl:
      `http://127.0.0.1:${address.port}`
  };
}

async function cleanup(environment) {
  await new Promise(
    (resolve, reject) => {
      environment.server.close(
        error =>
          error
            ? reject(error)
            : resolve()
      );
    }
  );

  rmSync(
    environment.directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "records an authenticated governed execution Usage Event",
  async () => {
    const environment =
      await startEnvironment();

    try {
      const response =
        await fetch(
          `${environment.baseUrl}/api/usage/events`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              authorization:
                `Bearer ${environment.evaluationLicenseKey}`
            },
            body:
              JSON.stringify({
                eventId:
                  "usage-api-event-001",
                occurredAt:
                  "2026-08-15T10:00:00.000Z",
                environment:
                  "production",
                riskLevel:
                  "high-risk",
                executionResult:
                  "contain",
                sdkVersion:
                  "1.0.1"
              })
          }
        );

      assert.equal(
        response.status,
        201
      );

      const body =
        await response.json();

      assert.equal(
        body.status,
        "recorded"
      );
    } finally {
      await cleanup(environment);
    }
  }
);

test(
  "returns duplicate without counting the same event twice",
  async () => {
    const environment =
      await startEnvironment();

    const request = () =>
      fetch(
        `${environment.baseUrl}/api/usage/events`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            authorization:
              `Bearer ${environment.evaluationLicenseKey}`
          },
          body:
            JSON.stringify({
              eventId:
                "usage-api-event-duplicate",
              occurredAt:
                "2026-08-15T10:00:00.000Z",
              environment:
                "production",
              riskLevel:
                "standard",
              executionResult:
                "allow",
              sdkVersion:
                "1.0.1"
            })
        }
      );

    try {
      const first =
        await request();

      const second =
        await request();

      assert.equal(
        first.status,
        201
      );

      assert.equal(
        second.status,
        200
      );

      const body =
        await second.json();

      assert.equal(
        body.status,
        "duplicate"
      );
    } finally {
      await cleanup(environment);
    }
  }
);

test(
  "rejects a Usage Event without a License Key",
  async () => {
    const environment =
      await startEnvironment();

    try {
      const response =
        await fetch(
          `${environment.baseUrl}/api/usage/events`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify({
                eventId:
                  "usage-api-event-unauthorized",
                occurredAt:
                  "2026-08-15T10:00:00.000Z",
                environment:
                  "production",
                riskLevel:
                  "standard",
                executionResult:
                  "allow",
                sdkVersion:
                  "1.0.1"
              })
          }
        );

      assert.equal(
        response.status,
        401
      );
    } finally {
      await cleanup(environment);
    }
  }
);
