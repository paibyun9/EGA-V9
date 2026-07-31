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
  verifyEvaluationLicenseKey
} = require(
  "../../../packages/sdk-ts/dist/license/license-key.js"
);

const {
  createLicenseApiServer
} = require(
  "../src/server.cjs"
);

async function startTestServer(
  options = {}
) {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-api-registry-"
      )
    );

  const server =
    createLicenseApiServer({
      ...options,
      registryPath:
        join(
          directoryPath,
          "license-registry.json"
        )
    });

  await new Promise(
    resolve => {
      server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );

  const address =
    server.address();

  if (
    !address ||
    typeof address === "string"
  ) {
    throw new Error(
      "Unable to resolve test server address."
    );
  }

  return {
    server,
    directoryPath,
    baseUrl:
      `http://127.0.0.1:${address.port}`
  };
}

async function stopServer(
  server,
  directoryPath
) {
  await new Promise(
    (resolve, reject) => {
      server.close(
        error =>
          error
            ? reject(error)
            : resolve()
      );
    }
  );

  rmSync(
    directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "POST evaluation endpoint issues and persists a signed 90-day Evaluation License",
  async () => {
    const {
      privateKey,
      publicKey
    } = generateKeyPairSync(
      "ed25519"
    );

    const {
      server,
      directoryPath,
      baseUrl
    } = await startTestServer({
      privateKey,
      now: () =>
        new Date(
          "2026-08-01T00:00:00.000Z"
        ),
      licenseIdFactory:
        () =>
          "eval_api_test_001"
    });

    try {
      const response =
        await fetch(
          `${baseUrl}/api/licenses/evaluation`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify({
                contactName:
                  "Test User",
                companyName:
                  "Test Company",
                workEmail:
                  "test@example.com"
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
        body.licenseId,
        "eval_api_test_001"
      );

      assert.equal(
        body.issuedAt,
        "2026-08-01T00:00:00.000Z"
      );

      assert.equal(
        body.expiresAt,
        "2026-10-30T00:00:00.000Z"
      );

      const license =
        verifyEvaluationLicenseKey(
          body.evaluationLicenseKey,
          publicKey
        );

      assert.equal(
        license.workEmail,
        "test@example.com"
      );
    } finally {
      await stopServer(
        server,
        directoryPath
      );
    }
  }
);

test(
  "rejects a second Evaluation License for the same Work Email",
  async () => {
    const {
      privateKey
    } = generateKeyPairSync(
      "ed25519"
    );

    const {
      server,
      directoryPath,
      baseUrl
    } = await startTestServer({
      privateKey
    });

    const request = () =>
      fetch(
        `${baseUrl}/api/licenses/evaluation`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json"
          },
          body:
            JSON.stringify({
              contactName:
                "Test User",
              companyName:
                "Test Company",
              workEmail:
                "test@example.com"
            })
        }
      );

    try {
      const first =
        await request();

      assert.equal(
        first.status,
        201
      );

      const second =
        await request();

      assert.equal(
        second.status,
        409
      );

      const body =
        await second.json();

      assert.equal(
        body.error.code,
        "EGA_LICENSE_TRIAL_ALREADY_ISSUED"
      );
    } finally {
      await stopServer(
        server,
        directoryPath
      );
    }
  }
);

test(
  "rejects invalid registration input",
  async () => {
    const {
      privateKey
    } = generateKeyPairSync(
      "ed25519"
    );

    const {
      server,
      directoryPath,
      baseUrl
    } = await startTestServer({
      privateKey
    });

    try {
      const response =
        await fetch(
          `${baseUrl}/api/licenses/evaluation`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify({
                contactName:
                  "Test User",
                companyName:
                  "Test Company",
                workEmail:
                  "invalid-email"
              })
          }
        );

      assert.equal(
        response.status,
        400
      );
    } finally {
      await stopServer(
        server,
        directoryPath
      );
    }
  }
);

test(
  "fails closed when the signing key is unavailable",
  async () => {
    const {
      server,
      directoryPath,
      baseUrl
    } = await startTestServer({
      privateKey: null
    });

    try {
      const response =
        await fetch(
          `${baseUrl}/api/licenses/evaluation`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify({
                contactName:
                  "Test User",
                companyName:
                  "Test Company",
                workEmail:
                  "test@example.com"
              })
          }
        );

      assert.equal(
        response.status,
        503
      );
    } finally {
      await stopServer(
        server,
        directoryPath
      );
    }
  }
);

test(
  "health endpoint reports signing availability",
  async () => {
    const {
      privateKey
    } = generateKeyPairSync(
      "ed25519"
    );

    const {
      server,
      directoryPath,
      baseUrl
    } = await startTestServer({
      privateKey
    });

    try {
      const response =
        await fetch(
          `${baseUrl}/health`
        );

      assert.equal(
        response.status,
        200
      );

      const body =
        await response.json();

      assert.equal(
        body.signingAvailable,
        true
      );
    } finally {
      await stopServer(
        server,
        directoryPath
      );
    }
  }
);
