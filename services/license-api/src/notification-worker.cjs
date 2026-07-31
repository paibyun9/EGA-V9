"use strict";

class NotificationWorkerError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "NotificationWorkerError";

    this.code =
      code;
  }
}

function registrySentFieldForTask(
  taskType
) {
  switch (taskType) {
    case "day60-commercial-reminder":
      return "day60ReminderSentAt";

    case "day83-expiration-warning":
      return "day83WarningSentAt";

    case "day90-evaluation-expired":
      return "expirationSentAt";

    default:
      throw new NotificationWorkerError(
        "EGA_NOTIFICATION_WORKER_TASK",
        `Unsupported notification task: ${taskType}`
      );
  }
}

async function processNotificationQueue(
  options
) {
  const {
    queue,
    registry,
    templateRepository,
    emailAdapter,
    nowFactory =
      () => new Date(),
    limit = 100
  } = options;

  if (
    !queue ||
    typeof queue.listTasks !==
      "function" ||
    typeof queue.updateTask !==
      "function"
  ) {
    throw new NotificationWorkerError(
      "EGA_NOTIFICATION_WORKER_QUEUE",
      "Notification Queue is unavailable."
    );
  }

  if (
    !registry ||
    typeof registry.updateRecord !==
      "function"
  ) {
    throw new NotificationWorkerError(
      "EGA_NOTIFICATION_WORKER_REGISTRY",
      "License Registry is unavailable."
    );
  }

  if (
    !templateRepository ||
    typeof templateRepository
      .loadTemplate !==
      "function"
  ) {
    throw new NotificationWorkerError(
      "EGA_NOTIFICATION_WORKER_TEMPLATE",
      "Email Template Repository is unavailable."
    );
  }

  if (
    !emailAdapter ||
    typeof emailAdapter.sendEmail !==
      "function"
  ) {
    throw new NotificationWorkerError(
      "EGA_NOTIFICATION_WORKER_ADAPTER",
      "Email Adapter is unavailable."
    );
  }

  const pendingTasks =
    queue
      .listTasks("pending")
      .slice(
        0,
        limit
      );

  const summary = {
    scanned:
      pendingTasks.length,

    sent: 0,

    failed: 0,

    results: []
  };

  const {
    renderEmailTemplate
  } = require(
    "./email-template-renderer.cjs"
  );

  for (
    const task of
    pendingTasks
  ) {
    const processingTime =
      nowFactory();

    queue.updateTask(
      task.taskId,
      {
        status:
          "processing",

        attempts:
          task.attempts + 1,

        processingStartedAt:
          processingTime
            .toISOString(),

        lastError:
          null
      },
      processingTime
    );

    try {
      const template =
        templateRepository
          .loadTemplate(
            task.taskType
          );

      const email =
        renderEmailTemplate(
          template,
          task
        );

      const delivery =
        await emailAdapter
          .sendEmail(email);

      const sentTime =
        nowFactory();

      queue.updateTask(
        task.taskId,
        {
          status:
            "sent",

          sentAt:
            sentTime
              .toISOString(),

          failedAt:
            null,

          templateId:
            email.templateId,

          templateVersion:
            email.templateVersion,

          deliveredSubject:
            email.subject,

          provider:
            delivery.provider,

          providerMessageId:
            delivery
              .providerMessageId,

          lastError:
            null
        },
        sentTime
      );

      const sentField =
        registrySentFieldForTask(
          task.taskType
        );

      registry.updateRecord(
        task.licenseId,
        {
          [sentField]:
            sentTime
              .toISOString()
        },
        sentTime
      );

      summary.sent += 1;

      summary.results.push({
        taskId:
          task.taskId,

        status:
          "sent",

        templateId:
          email.templateId,

        templateVersion:
          email.templateVersion,

        providerMessageId:
          delivery
            .providerMessageId
      });
    } catch (error) {
      const failedTime =
        nowFactory();

      const message =
        error instanceof Error
          ? error.message
          : "Unknown email delivery error.";

      queue.updateTask(
        task.taskId,
        {
          status:
            "failed",

          failedAt:
            failedTime
              .toISOString(),

          lastError:
            message
        },
        failedTime
      );

      summary.failed += 1;

      summary.results.push({
        taskId:
          task.taskId,

        status:
          "failed",

        error:
          message
      });
    }
  }

  return summary;
}

module.exports = {
  NotificationWorkerError,
  processNotificationQueue,
  registrySentFieldForTask
};
