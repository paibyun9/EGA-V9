"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  NotificationQueueError,
  createFileNotificationQueue,
  deterministicTaskId
} = require(
  "../src/notification-queue.cjs"
);

function createTestQueue() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-notification-queue-"
      )
    );

  const queuePath =
    join(
      directoryPath,
      "queue.json"
    );

  const queue =
    createFileNotificationQueue({
      queuePath
    });

  queue.initialize();

  return {
    directoryPath,
    queuePath,
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

function taskInput(
  taskType =
    "day60-commercial-reminder"
) {
  return {
    taskType,
    licenseId:
      "eval_queue_001",
    workEmail:
      "test@example.com",
    contactName:
      "Test User",
    companyName:
      "Test Company",
    issuedAt:
      "2026-08-01T00:00:00.000Z",
    expiresAt:
      "2026-10-30T00:00:00.000Z"
  };
}

test(
  "initializes a private persistent Notification Queue",
  () => {
    const {
      directoryPath,
      queuePath,
      queue
    } = createTestQueue();

    try {
      assert.deepEqual(
        queue.listTasks(),
        []
      );

      if (
        process.platform !==
          "win32"
      ) {
        assert.equal(
          statSync(
            queuePath
          ).mode & 0o777,
          0o600
        );
      }
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "enqueues a deterministic pending task",
  () => {
    const {
      directoryPath,
      queue
    } = createTestQueue();

    try {
      const result =
        queue.enqueue(
          taskInput(),
          new Date(
            "2026-09-30T00:00:00.000Z"
          )
        );

      assert.equal(
        result.created,
        true
      );

      assert.equal(
        result.task.taskId,
        deterministicTaskId(
          "eval_queue_001",
          "day60-commercial-reminder"
        )
      );

      assert.equal(
        result.task.status,
        "pending"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);

test(
  "does not create the same lifecycle task twice",
  () => {
    const {
      directoryPath,
      queue
    } = createTestQueue();

    try {
      const first =
        queue.enqueue(
          taskInput(),
          new Date(
            "2026-09-30T00:00:00.000Z"
          )
        );

      const second =
        queue.enqueue(
          taskInput(),
          new Date(
            "2026-10-01T00:00:00.000Z"
          )
        );

      assert.equal(
        first.created,
        true
      );

      assert.equal(
        second.created,
        false
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
  "fails closed when the Notification Queue is corrupt",
  () => {
    const {
      directoryPath,
      queuePath,
      queue
    } = createTestQueue();

    try {
      writeFileSync(
        queuePath,
        "{invalid json",
        "utf8"
      );

      assert.throws(
        () =>
          queue.listTasks(),
        error =>
          error instanceof
            NotificationQueueError &&
          error.code ===
            "EGA_NOTIFICATION_QUEUE_CORRUPT"
      );
    } finally {
      cleanup(
        directoryPath
      );
    }
  }
);
