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
  createFileEmailTemplateRepository
} = require(
  "./email-template-repository.cjs"
);

const {
  createMockEmailAdapter
} = require(
  "./email-adapter.cjs"
);

const {
  processNotificationQueue
} = require(
  "./notification-worker.cjs"
);

async function main() {
  const registry =
    createFileLicenseRegistry();

  const queue =
    createFileNotificationQueue();

  const templateRepository =
    createFileEmailTemplateRepository();

  const emailAdapter =
    createMockEmailAdapter();

  registry.initialize();
  queue.initialize();

  const summary =
    await processNotificationQueue({
      registry,
      queue,
      templateRepository,
      emailAdapter
    });

  console.log(
    JSON.stringify(
      {
        status:
          "ok",

        adapter:
          "mock",

        processedAt:
          new Date()
            .toISOString(),

        ...summary,

        mockDeliveries:
          emailAdapter
            .listDeliveries()
      },
      null,
      2
    )
  );
}

main().catch(
  error => {
    console.error(
      JSON.stringify(
        {
          status:
            "error",

          message:
            error instanceof Error
              ? error.message
              : "Unknown notification worker error."
        },
        null,
        2
      )
    );

    process.exitCode = 1;
  }
);
