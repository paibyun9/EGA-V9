"use strict";

const test =
  require("node:test");

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

const {
  createFileLicenseRegistry
} = require(
  "../src/license-registry.cjs"
);

const {
  createFileNotificationQueue
} = require(
  "../src/notification-queue.cjs"
);

const {
  createFileEmailTemplateRepository
} = require(
  "../src/email-template-repository.cjs"
);

const {
  createMockEmailAdapter
} = require(
  "../src/email-adapter.cjs"
);

const {
  processNotificationQueue
} = require(
  "../src/notification-worker.cjs"
);

function createEnvironment(
  adapterOptions = {}
) {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-worker-"
      )
    );

  const registry =
    createFileLicenseRegistry({
      registryPath:
        join(
          directoryPath,
          "registry.json"
        )
    });

  const queue =
    createFileNotificationQueue({
      queuePath:
        join(
          directoryPath,
          "queue.json"
        )
    });

  registry.initialize();
  queue.initialize();

  registry.createEvaluationRecord({
    licenseId:
      "eval_worker_001",

    contactName:
      "Byun DJ",

    companyName:
      "LCM",

    workEmail:
      "contact@lcm3.com",

    issuedAt:
      "2026-08-01T00:00:00.000Z",

    expiresAt:
      "2026-10-30T00:00:00.000Z",

    status:
      "active",

    createdAt:
      new Date(
        "2026-08-01T00:00:00.000Z"
      )
  });

  queue.enqueue(
    {
      taskType:
        "day60-commercial-reminder",

      licenseId:
        "eval_worker_001",

      contactName:
        "Byun DJ",

      companyName:
        "LCM",

      workEmail:
        "contact@lcm3.com",

      issuedAt:
        "2026-08-01T00:00:00.000Z",

      expiresAt:
        "2026-10-30T00:00:00.000Z"
    },
    new Date(
      "2026-09-30T00:00:00.000Z"
    )
  );

  return {
    directoryPath,
    registry,
    queue,

    templateRepository:
      createFileEmailTemplateRepository(),

    emailAdapter:
      createMockEmailAdapter(
        adapterOptions
      )
  };
}

function cleanup(
  directoryPath
) {
  rmSync(
    directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "worker renders the latest template and marks the task sent",
  async () => {
    const environment =
      createEnvironment();

    const times = [
      new Date(
        "2026-09-30T01:00:00.000Z"
      ),
      new Date(
        "2026-09-30T01:00:01.000Z"
      )
    ];

    try {
      const summary =
        await processNotificationQueue({
          ...environment,

          nowFactory:
            () =>
              times.shift() ??
              new Date(
                "2026-09-30T01:00:01.000Z"
              )
        });

      assert.equal(
        summary.sent,
        1
      );

      assert.equal(
        summary.failed,
        0
      );

      const sentTask =
        environment.queue
          .listTasks("sent")[0];

      assert.equal(
        sentTask.templateId,
        "day60-commercial-reminder"
      );

      assert.equal(
        sentTask.templateVersion,
        1
      );

      assert.equal(
        sentTask.provider,
        "mock"
      );

      assert.equal(
        typeof sentTask
          .providerMessageId,
        "string"
      );

      assert.equal(
        environment.registry
          .findByLicenseId(
            "eval_worker_001"
          )
          .day60ReminderSentAt,
        "2026-09-30T01:00:01.000Z"
      );

      assert.equal(
        environment.emailAdapter
          .listDeliveries()
          .length,
        1
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);

test(
  "worker records a failed delivery without marking the Registry sent",
  async () => {
    const environment =
      createEnvironment({
        failForAddress:
          "contact@lcm3.com"
      });

    try {
      const summary =
        await processNotificationQueue({
          ...environment,

          nowFactory:
            () =>
              new Date(
                "2026-09-30T01:00:00.000Z"
              )
        });

      assert.equal(
        summary.sent,
        0
      );

      assert.equal(
        summary.failed,
        1
      );

      const failedTask =
        environment.queue
          .listTasks("failed")[0];

      assert.equal(
        failedTask.attempts,
        1
      );

      assert.match(
        failedTask.lastError,
        /Mock email delivery failed/
      );

      assert.equal(
        environment.registry
          .findByLicenseId(
            "eval_worker_001"
          )
          .day60ReminderSentAt,
        null
      );
    } finally {
      cleanup(
        environment
          .directoryPath
      );
    }
  }
);
