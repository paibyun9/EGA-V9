"use strict";

const {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} = require("node:fs");

const {
  createHash,
  randomUUID
} = require("node:crypto");

const {
  dirname,
  resolve
} = require("node:path");

const QUEUE_SCHEMA_VERSION = 1;

const TASK_TYPES = new Set([
  "day60-commercial-reminder",
  "day83-expiration-warning",
  "day90-evaluation-expired"
]);

const TASK_STATUSES = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled"
]);

class NotificationQueueError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(
      `[${code}] ${message}`
    );

    this.name =
      "NotificationQueueError";

    this.code =
      code;
  }
}

function createEmptyQueue() {
  return {
    schemaVersion:
      QUEUE_SCHEMA_VERSION,
    tasks: []
  };
}

function deterministicTaskId(
  licenseId,
  taskType
) {
  const digest =
    createHash("sha256")
      .update(
        `${licenseId}:${taskType}`,
        "utf8"
      )
      .digest("hex")
      .slice(0, 24);

  return `license_task_${digest}`;
}

function requireString(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      `${fieldName} is required.`
    );
  }

  return value.trim();
}

function requireIsoDate(
  value,
  fieldName
) {
  const normalized =
    requireString(
      value,
      fieldName
    );

  if (
    Number.isNaN(
      new Date(normalized).getTime()
    )
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      `${fieldName} must be a valid ISO-8601 date string.`
    );
  }

  return normalized;
}

function validateTask(
  task
) {
  if (
    typeof task !== "object" ||
    task === null ||
    Array.isArray(task)
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      "Notification task must be an object."
    );
  }

  if (
    !TASK_TYPES.has(
      task.taskType
    )
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      "Notification taskType is invalid."
    );
  }

  if (
    !TASK_STATUSES.has(
      task.status
    )
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      "Notification task status is invalid."
    );
  }

  if (
    !Number.isInteger(
      task.attempts
    ) ||
    task.attempts < 0
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      "Notification attempts must be a non-negative integer."
    );
  }

  const licenseId =
    requireString(
      task.licenseId,
      "licenseId"
    );

  const taskType =
    task.taskType;

  const expectedTaskId =
    deterministicTaskId(
      licenseId,
      taskType
    );

  if (
    task.taskId !==
    expectedTaskId
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_TASK",
      "Notification taskId is not deterministic."
    );
  }

  return {
    taskId:
      expectedTaskId,
    taskType,
    licenseId,
    workEmail:
      requireString(
        task.workEmail,
        "workEmail"
      ).toLowerCase(),
    contactName:
      requireString(
        task.contactName,
        "contactName"
      ),
    companyName:
      requireString(
        task.companyName,
        "companyName"
      ),
    issuedAt:
      requireIsoDate(
        task.issuedAt,
        "issuedAt"
      ),
    expiresAt:
      requireIsoDate(
        task.expiresAt,
        "expiresAt"
      ),
    status:
      task.status,
    attempts:
      task.attempts,
    lastError:
      task.lastError ??
      null,
    processingStartedAt:
      task.processingStartedAt ??
      null,
    sentAt:
      task.sentAt ??
      null,
    failedAt:
      task.failedAt ??
      null,
    templateId:
      task.templateId ??
      null,
    templateVersion:
      task.templateVersion ??
      null,
    deliveredSubject:
      task.deliveredSubject ??
      null,
    provider:
      task.provider ??
      null,
    providerMessageId:
      task.providerMessageId ??
      null,
    createdAt:
      requireIsoDate(
        task.createdAt,
        "createdAt"
      ),
    updatedAt:
      requireIsoDate(
        task.updatedAt,
        "updatedAt"
      )
  };
}

function validateQueueData(
  value
) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.schemaVersion !==
      QUEUE_SCHEMA_VERSION ||
    !Array.isArray(value.tasks)
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_CORRUPT",
      "Notification Queue has an unsupported or corrupt structure."
    );
  }

  const tasks =
    value.tasks.map(
      validateTask
    );

  const taskIds =
    new Set();

  for (
    const task of tasks
  ) {
    if (
      taskIds.has(
        task.taskId
      )
    ) {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_CORRUPT",
        `Duplicate notification task found: ${task.taskId}`
      );
    }

    taskIds.add(
      task.taskId
    );
  }

  return {
    schemaVersion:
      QUEUE_SCHEMA_VERSION,
    tasks
  };
}

function assertSafeQueueFile(
  queuePath
) {
  const status =
    lstatSync(queuePath);

  if (
    status.isSymbolicLink() ||
    !status.isFile()
  ) {
    throw new NotificationQueueError(
      "EGA_NOTIFICATION_QUEUE_PATH",
      "Notification Queue path must be a regular file and must not be a symbolic link."
    );
  }
}

function createFileNotificationQueue(
  options = {}
) {
  const queuePath =
    resolve(
      options.queuePath ??
      process.env
        .EGA_V9_NOTIFICATION_QUEUE_PATH ??
      "./data/license-notification-queue.json"
    );

  function writeQueue(
    queue
  ) {
    const validated =
      validateQueueData(
        queue
      );

    const directoryPath =
      dirname(queuePath);

    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    const temporaryPath =
      `${queuePath}.tmp-${process.pid}-${randomUUID()}`;

    try {
      writeFileSync(
        temporaryPath,
        `${JSON.stringify(
          validated,
          null,
          2
        )}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx"
        }
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          temporaryPath,
          0o600
        );
      }

      renameSync(
        temporaryPath,
        queuePath
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          queuePath,
          0o600
        );
      }
    } finally {
      if (
        existsSync(
          temporaryPath
        )
      ) {
        rmSync(
          temporaryPath,
          {
            force: true
          }
        );
      }
    }
  }

  function initialize() {
    const directoryPath =
      dirname(queuePath);

    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    if (
      process.platform !==
        "win32"
    ) {
      chmodSync(
        directoryPath,
        0o700
      );
    }

    if (
      !existsSync(
        queuePath
      )
    ) {
      writeQueue(
        createEmptyQueue()
      );
    }

    return queuePath;
  }

  function readQueue() {
    if (
      !existsSync(
        queuePath
      )
    ) {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_UNAVAILABLE",
        "Notification Queue does not exist."
      );
    }

    assertSafeQueueFile(
      queuePath
    );

    let parsed;

    try {
      parsed =
        JSON.parse(
          readFileSync(
            queuePath,
            "utf8"
          )
        );
    } catch {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_CORRUPT",
        "Notification Queue contains invalid JSON."
      );
    }

    return validateQueueData(
      parsed
    );
  }

  function enqueue(
    input,
    now = new Date()
  ) {
    if (
      !(now instanceof Date) ||
      Number.isNaN(
        now.getTime()
      )
    ) {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_TASK",
        "Queue time is invalid."
      );
    }

    const taskId =
      deterministicTaskId(
        input.licenseId,
        input.taskType
      );

    const queue =
      readQueue();

    const existing =
      queue.tasks.find(
        task =>
          task.taskId ===
          taskId
      );

    if (existing) {
      return {
        task: {
          ...existing
        },
        created: false
      };
    }

    const nowIso =
      now.toISOString();

    const task =
      validateTask({
        taskId,
        taskType:
          input.taskType,
        licenseId:
          input.licenseId,
        workEmail:
          input.workEmail,
        contactName:
          input.contactName,
        companyName:
          input.companyName,
        issuedAt:
          input.issuedAt,
        expiresAt:
          input.expiresAt,
        status:
          "pending",
        attempts:
          0,
        lastError:
          null,
        createdAt:
          nowIso,
        updatedAt:
          nowIso
      });

    queue.tasks.push(
      task
    );

    writeQueue(queue);

    return {
      task,
      created: true
    };
  }

  function listTasks(
    status
  ) {
    const tasks =
      readQueue().tasks;

    return tasks
      .filter(
        task =>
          !status ||
          task.status ===
            status
      )
      .map(
        task => ({
          ...task
        })
      );
  }

  function findByTaskId(
    taskId
  ) {
    return (
      readQueue()
        .tasks
        .find(
          task =>
            task.taskId ===
            taskId
        ) ??
      null
    );
  }

  function updateTask(
    taskId,
    changes,
    now = new Date()
  ) {
    if (
      !(now instanceof Date) ||
      Number.isNaN(
        now.getTime()
      )
    ) {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_TASK",
        "Task update time is invalid."
      );
    }

    const queue =
      readQueue();

    const taskIndex =
      queue.tasks.findIndex(
        task =>
          task.taskId ===
          taskId
      );

    if (taskIndex === -1) {
      throw new NotificationQueueError(
        "EGA_NOTIFICATION_QUEUE_NOT_FOUND",
        `Notification task not found: ${taskId}`
      );
    }

    const protectedFields =
      new Set([
        "taskId",
        "taskType",
        "licenseId",
        "workEmail",
        "contactName",
        "companyName",
        "issuedAt",
        "expiresAt",
        "createdAt"
      ]);

    for (
      const field of
      Object.keys(changes)
    ) {
      if (
        protectedFields.has(
          field
        )
      ) {
        throw new NotificationQueueError(
          "EGA_NOTIFICATION_QUEUE_TASK",
          `${field} cannot be modified.`
        );
      }
    }

    const nextTask =
      validateTask({
        ...queue.tasks[
          taskIndex
        ],
        ...changes,
        updatedAt:
          now.toISOString()
      });

    queue.tasks[
      taskIndex
    ] = nextTask;

    writeQueue(queue);

    return {
      ...nextTask
    };
  }

  return {
    queuePath,
    initialize,
    readQueue,
    enqueue,
    listTasks,
    findByTaskId,
    updateTask
  };
}

module.exports = {
  QUEUE_SCHEMA_VERSION,
  NotificationQueueError,
  createFileNotificationQueue,
  deterministicTaskId
};
