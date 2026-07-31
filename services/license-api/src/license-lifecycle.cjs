"use strict";

const DAY_MS =
  24 * 60 * 60 * 1000;

const TERMINAL_STATUSES =
  new Set([
    "commercial",
    "closed"
  ]);

class LicenseLifecycleError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(
      `[${code}] ${message}`
    );

    this.name =
      "LicenseLifecycleError";

    this.code =
      code;
  }
}

function parseDate(
  value,
  fieldName
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new LicenseLifecycleError(
      "EGA_LICENSE_LIFECYCLE_RECORD",
      `${fieldName} is invalid.`
    );
  }

  return date;
}

function calculateLifecycle(
  record,
  now = new Date()
) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(
      now.getTime()
    )
  ) {
    throw new LicenseLifecycleError(
      "EGA_LICENSE_LIFECYCLE_CLOCK",
      "Lifecycle clock is invalid."
    );
  }

  if (
    TERMINAL_STATUSES.has(
      record.status
    )
  ) {
    return {
      phase: "terminal",
      taskType: null,
      nextStatus:
        record.status,
      daysElapsed: null,
      daysRemaining: null,
      reason:
        "Commercial or closed records do not receive Evaluation lifecycle notifications."
    };
  }

  const issuedAt =
    parseDate(
      record.issuedAt,
      "issuedAt"
    );

  const expiresAt =
    parseDate(
      record.expiresAt,
      "expiresAt"
    );

  const daysElapsed =
    Math.max(
      0,
      Math.floor(
        (
          now.getTime() -
          issuedAt.getTime()
        ) /
        DAY_MS
      )
    );

  const remainingMs =
    expiresAt.getTime() -
    now.getTime();

  const daysRemaining =
    Math.max(
      0,
      Math.ceil(
        remainingMs /
        DAY_MS
      )
    );

  if (
    remainingMs <= 0
  ) {
    return {
      phase: "expired",
      taskType:
        record.expirationQueuedAt
          ? null
          : "day90-evaluation-expired",
      nextStatus:
        "expired",
      daysElapsed,
      daysRemaining: 0,
      reason:
        "The 90-day Evaluation License has expired."
    };
  }

  if (
    daysElapsed >= 83
  ) {
    return {
      phase: "day83-warning",
      taskType:
        record.day83WarningQueuedAt
          ? null
          : "day83-expiration-warning",
      nextStatus:
        "expiring",
      daysElapsed,
      daysRemaining,
      reason:
        "The Evaluation License expires within seven days."
    };
  }

  if (
    daysElapsed >= 60
  ) {
    return {
      phase: "day60-reminder",
      taskType:
        record.day60ReminderQueuedAt
          ? null
          : "day60-commercial-reminder",
      nextStatus:
        record.status ===
          "commercial-requested"
          ? "commercial-requested"
          : "active",
      daysElapsed,
      daysRemaining,
      reason:
        "The Evaluation License has reached the commercial reminder point."
    };
  }

  return {
    phase: "active",
    taskType: null,
    nextStatus:
      record.status ===
        "commercial-requested"
        ? "commercial-requested"
        : "active",
    daysElapsed,
    daysRemaining,
    reason:
      "No lifecycle notification is currently due."
  };
}

function queuedAtFieldForTask(
  taskType
) {
  switch (taskType) {
    case "day60-commercial-reminder":
      return "day60ReminderQueuedAt";

    case "day83-expiration-warning":
      return "day83WarningQueuedAt";

    case "day90-evaluation-expired":
      return "expirationQueuedAt";

    default:
      throw new LicenseLifecycleError(
        "EGA_LICENSE_LIFECYCLE_TASK",
        `Unsupported lifecycle task: ${taskType}`
      );
  }
}

function processLicenseLifecycle(
  options
) {
  const {
    registry,
    queue,
    now = new Date()
  } = options;

  if (
    !registry ||
    typeof registry.listRecords !==
      "function" ||
    typeof registry.updateRecord !==
      "function"
  ) {
    throw new LicenseLifecycleError(
      "EGA_LICENSE_LIFECYCLE_REGISTRY",
      "License Registry is unavailable."
    );
  }

  if (
    !queue ||
    typeof queue.enqueue !==
      "function"
  ) {
    throw new LicenseLifecycleError(
      "EGA_LICENSE_LIFECYCLE_QUEUE",
      "Notification Queue is unavailable."
    );
  }

  const records =
    registry.listRecords();

  const summary = {
    scanned:
      records.length,
    queued: 0,
    statusUpdated: 0,
    unchanged: 0,
    tasks: []
  };

  for (
    const record of records
  ) {
    const evaluation =
      calculateLifecycle(
        record,
        now
      );

    const changes = {};

    if (
      evaluation.nextStatus !==
      record.status
    ) {
      changes.status =
        evaluation.nextStatus;
    }

    if (
      evaluation.taskType
    ) {
      const queueResult =
        queue.enqueue(
          {
            taskType:
              evaluation.taskType,
            licenseId:
              record.licenseId,
            workEmail:
              record.workEmail,
            contactName:
              record.contactName,
            companyName:
              record.companyName,
            issuedAt:
              record.issuedAt,
            expiresAt:
              record.expiresAt
          },
          now
        );

      const queuedAtField =
        queuedAtFieldForTask(
          evaluation.taskType
        );

      changes[
        queuedAtField
      ] = now.toISOString();

      if (
        queueResult.created
      ) {
        summary.queued += 1;

        summary.tasks.push({
          taskId:
            queueResult.task.taskId,
          taskType:
            queueResult.task.taskType,
          licenseId:
            record.licenseId
        });
      }
    }

    if (
      Object.keys(changes)
        .length > 0
    ) {
      registry.updateRecord(
        record.licenseId,
        changes,
        now
      );

      summary.statusUpdated += 1;
    } else {
      summary.unchanged += 1;
    }
  }

  return summary;
}

module.exports = {
  DAY_MS,
  LicenseLifecycleError,
  calculateLifecycle,
  processLicenseLifecycle,
  queuedAtFieldForTask
};
