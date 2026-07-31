"use strict";

const {
  createFileLicenseRegistry
} = require(
  "./license-registry.cjs"
);

const {
  createFileNotificationQueue
} = require(
  "./notification-queue.cjs"
);

const {
  processLicenseLifecycle
} = require(
  "./license-lifecycle.cjs"
);

function main() {
  const registry =
    createFileLicenseRegistry();

  const queue =
    createFileNotificationQueue();

  registry.initialize();
  queue.initialize();

  const summary =
    processLicenseLifecycle({
      registry,
      queue,
      now: new Date()
    });

  console.log(
    JSON.stringify(
      {
        status: "ok",
        processedAt:
          new Date()
            .toISOString(),
        ...summary
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
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown lifecycle processing error."
      },
      null,
      2
    )
  );

  process.exitCode = 1;
}
