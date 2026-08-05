"use strict";

const assert =
  require("node:assert/strict");

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

const test =
  require("node:test");

const {
  createPrivateKey,
  generateKeyPairSync
} = require("node:crypto");

const {
  createLicenseApiServer
} = require(
  "../src/server.cjs"
);

const {
  createFileLicenseRegistry
} = require(
  "../src/license-registry.cjs"
);

function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-internal-registry-api-"
      )
    );

  const registryPath =
    join(
      directory,
      "license-registry.json"
    );

  const registry =
    createFileLicenseRegistry({
      registryPath
    });

  registry.initialize();

  registry.createEvaluationRecord({
    licenseId:
      "eval_test_internal_1",

    contactName:
      "Byun, daejung",

    companyName:
      "LCM",

    workEmail:
      "contact@lcm3.com",

    issuedAt:
      "2026-08-02T21:56:34.636Z",

    expiresAt:
      "2026-10-31T21:56:34.636Z",

    status:
      "active",

    createdAt:
      new Date(
        "2026-08-02T21:56:34.636Z"
      )
  });

  const {
    privateKey
  } =
    generateKeyPairSync(
      "ed25519"
    );

  const internalToken =
    "test-internal-token-1234567890-abcdef";

  const server =
    createLicenseApiServer({
      registry,
      privateKey:
        createPrivateKey(
          privateKey.export({
            format: "pem",
            type: "pkcs8"
          })
        ),

      internalRegistryReadToken:
        internalToken
    });

  return {
    directory,
    registry,
    server,
    internalToken
  };
}

async function startContext() {
  const context =
    createContext();

  await new Promise(
    (resolve) => {
      context.server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );

  const address =
    context.server.address();

  return {
    ...context,

    baseUrl:
      `http://127.0.0.1:${address.port}`
  };
}

async function closeContext(
  context
) {
  await new Promise(
    (resolve, reject) => {
      context.server.close(
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    }
  );

  rmSync(
    context.directory,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "Internal Registry API rejects missing authorization",
  async () => {
    const context =
      await startContext();

    try {
      const response =
        await fetch(
          `${context.baseUrl}` +
          "/api/internal/license-registry/records"
        );

      assert.equal(
        response.status,
        401
      );

      const payload =
        await response.json();

      assert.equal(
        payload.error.code,
        "EGA_INTERNAL_REGISTRY_UNAUTHORIZED"
      );
    } finally {
      await closeContext(
        context
      );
    }
  }
);

test(
  "Internal Registry API rejects invalid token",
  async () => {
    const context =
      await startContext();

    try {
      const response =
        await fetch(
          `${context.baseUrl}` +
          "/api/internal/license-registry/records",
          {
            headers: {
              authorization:
                "Bearer invalid-token"
            }
          }
        );

      assert.equal(
        response.status,
        401
      );
    } finally {
      await closeContext(
        context
      );
    }
  }
);

test(
  "Internal Registry API returns sanitized records",
  async () => {
    const context =
      await startContext();

    try {
      const response =
        await fetch(
          `${context.baseUrl}` +
          "/api/internal/license-registry/records",
          {
            headers: {
              authorization:
                `Bearer ${context.internalToken}`
            }
          }
        );

      assert.equal(
        response.status,
        200
      );

      const payload =
        await response.json();

      assert.equal(
        payload.schemaVersion,
        1
      );

      assert.equal(
        payload.count,
        1
      );

      assert.deepEqual(
        Object.keys(
          payload.records[0]
        ).sort(),
        [
          "companyName",
          "contactName",
          "createdAt",
          "expiresAt",
          "issuedAt",
          "licenseId",
          "status",
          "updatedAt",
          "workEmail"
        ].sort()
      );

      assert.equal(
        payload.records[0]
          .companyName,
        "LCM"
      );

      assert.equal(
        payload.records[0]
          .workEmail,
        "contact@lcm3.com"
      );

      assert.equal(
        "normalizedWorkEmail"
          in payload.records[0],
        false
      );

      assert.equal(
        "day60ReminderQueuedAt"
          in payload.records[0],
        false
      );
    } finally {
      await closeContext(
        context
      );
    }
  }
);

test(
  "Internal Registry API is GET only",
  async () => {
    const context =
      await startContext();

    try {
      const response =
        await fetch(
          `${context.baseUrl}` +
          "/api/internal/license-registry/records",
          {
            method: "POST",

            headers: {
              authorization:
                `Bearer ${context.internalToken}`
            }
          }
        );

      assert.equal(
        response.status,
        405
      );

      assert.equal(
        response.headers.get(
          "allow"
        ),
        "GET"
      );
    } finally {
      await closeContext(
        context
      );
    }
  }
);
