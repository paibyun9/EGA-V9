"use strict";

const {
  createPrivateKey,
  createPublicKey
} = require(
  "node:crypto"
);

const {
  createFileLicenseRegistry
} = require(
  "./license-registry.cjs"
);

const {
  createCommercialUpgradeService
} = require(
  "./commercial-upgrade-service.cjs"
);

function argumentValue(
  name
) {
  const index =
    process.argv.indexOf(
      name
    );

  if (
    index === -1 ||
    index + 1 >=
      process.argv.length
  ) {
    return null;
  }

  return process.argv[
    index + 1
  ];
}

function main() {
  const requestId =
    argumentValue(
      "--request-id"
    );

  const expiresAt =
    argumentValue(
      "--expires-at"
    );

  const privateKeyPem =
    process.env
      .EGA_V9_LICENSE_PRIVATE_KEY_PEM;

  if (!privateKeyPem) {
    throw new Error(
      "EGA_V9_LICENSE_PRIVATE_KEY_PEM is required."
    );
  }

  if (!requestId) {
    throw new Error(
      "--request-id is required."
    );
  }

  const privateKey =
    createPrivateKey(
      privateKeyPem
    );

  const registry =
    createFileLicenseRegistry();

  registry.initialize();

  const service =
    createCommercialUpgradeService({
      registry,
      privateKey,
      publicKey:
        createPublicKey(
          privateKey
        )
    });

  const result =
    service.approveUpgrade({
      requestId,
      expiresAt
    });

  console.log(
    JSON.stringify(
      {
        status:
          "ok",
        ...result
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status:
          "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown Commercial approval error."
      },
      null,
      2
    )
  );

  process.exitCode = 1;
}
