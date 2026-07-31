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
  calculateLifecycle,
  processLicenseLifecycle
} = require(
  "../src/license-lifecycle.cjs"
);

function createEnvironment() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-lifecycle-"
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

  return {
    directoryPath,
    registry,
    queue
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

function createRecord(
  registry,
  overrides = {}
) {
  return registry
    .createEvaluationRecord({
      licenseId:
        overrides.licenseId ??
        "eval_lifecycle_001",
      contactName:
        "Test User",
      companyName:
        "Test Company",
      workEmail:
        overrides.workEmail ??
        "test@example.com",
      issuedAt:
        "2026-08-01T00:00:00.000Z",
      expiresAt:
        "2026-10-30T00:00:00.000Z",
      status:
        overrides.status ??
        "active",
      createdAt:
        new Date(
          "2026-08-01T00:00:00.000Z"
        )
    });
}

test(
  "Day 59 has no notification task",
  () => {
    const {
      directoryPath,
      registry,
      queue
    } = createEnvironment();

    try {
      createRecord(registry);

      const summary =
        processLicenseLifecycle({
          registry,
          queue,
          now:
            new Date(
              "2026-09-29T00:00:00.000Z"
            )
        });

      assert.equal(
        summary.queued,
        0
      );

      assert.equal(
        queue.listTasks().length,
        0
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "Day 60 queues one Commercial Reminder",
  () => {
    const {
      directoryPath,
      registry,
      queue
    } = createEnvironment();

    try {
      createRecord(registry);

      const now =
        new Date(
          "2026-09-30T00:00:00.000Z"
        );

      const summary =
        processLicenseLifecycle({
          registry,
          queue,
          now
        });

      assert.equal(
        summary.queued,
        1
      );

      assert.equal(
        queue.listTasks()[0]
          .taskType,
        "day60-commercial-reminder"
      );

      assert.equal(
        registry
          .findByLicenseId(
            "eval_lifecycle_001"
          )
          .day60ReminderQueuedAt,
        now.toISOString()
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "Day 83 queues only the seven-day warning when earlier processing was missed",
  () => {
    const {
      directoryPath,
      registry,
      queue
    } = createEnvironment();

    try {
      createRecord(registry);

      processLicenseLifecycle({
        registry,
        queue,
        now:
          new Date(
            "2026-10-23T00:00:00.000Z"
          )
      });

      const tasks =
        queue.listTasks();

      assert.equal(
        tasks.length,
        1
      );

      assert.equal(
        tasks[0].taskType,
        "day83-expiration-warning"
      );

      assert.equal(
        registry
          .findByLicenseId(
            "eval_lifecycle_001"
          )
          .status,
        "expiring"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "Day 90 queues expiration and marks the Evaluation License expired",
  () => {
    const {
      directoryPath,
      registry,
      queue
    } = createEnvironment();

    try {
      createRecord(registry);

      processLicenseLifecycle({
        registry,
        queue,
        now:
          new Date(
            "2026-10-30T00:00:00.000Z"
          )
      });

      assert.equal(
        queue.listTasks()[0]
          .taskType,
        "day90-evaluation-expired"
      );

      assert.equal(
        registry
          .findByLicenseId(
            "eval_lifecycle_001"
          )
          .status,
        "expired"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "repeated lifecycle processing creates no duplicate tasks",
  () => {
    const {
      directoryPath,
      registry,
      queue
    } = createEnvironment();

    try {
      createRecord(registry);

      const now =
        new Date(
          "2026-09-30T00:00:00.000Z"
        );

      const first =
        processLicenseLifecycle({
          registry,
          queue,
          now
        });

      const second =
        processLicenseLifecycle({
          registry,
          queue,
          now
        });

      assert.equal(
        first.queued,
        1
      );

      assert.equal(
        second.queued,
        0
      );

      assert.equal(
        queue.listTasks().length,
        1
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "Commercial License records are excluded from Evaluation notifications",
  () => {
    const evaluation =
      calculateLifecycle(
        {
          status:
            "commercial",
          issuedAt:
            "2026-08-01T00:00:00.000Z",
          expiresAt:
            "2026-10-30T00:00:00.000Z"
        },
        new Date(
          "2026-10-30T00:00:00.000Z"
        )
      );

    assert.equal(
      evaluation.phase,
      "terminal"
    );

    assert.equal(
      evaluation.taskType,
      null
    );
  }
);
