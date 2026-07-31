"use strict";

const {
  existsSync,
  lstatSync,
  readFileSync
} = require("node:fs");

const {
  join,
  resolve
} = require("node:path");

const TEMPLATE_FILE_BY_TASK_TYPE = {
  "day60-commercial-reminder":
    "day60-commercial-reminder.json",

  "day83-expiration-warning":
    "day83-expiration-warning.json",

  "day90-evaluation-expired":
    "day90-evaluation-expired.json"
};

class EmailTemplateRepositoryError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "EmailTemplateRepositoryError";

    this.code =
      code;
  }
}

function requireNonEmptyString(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new EmailTemplateRepositoryError(
      "EGA_EMAIL_TEMPLATE_INVALID",
      `${fieldName} is required.`
    );
  }

  return value.trim();
}

function validateTemplate(
  template,
  expectedTaskType
) {
  if (
    typeof template !== "object" ||
    template === null ||
    Array.isArray(template)
  ) {
    throw new EmailTemplateRepositoryError(
      "EGA_EMAIL_TEMPLATE_INVALID",
      "Email template must be a JSON object."
    );
  }

  if (
    !Number.isInteger(
      template.templateVersion
    ) ||
    template.templateVersion < 1
  ) {
    throw new EmailTemplateRepositoryError(
      "EGA_EMAIL_TEMPLATE_INVALID",
      "templateVersion must be a positive integer."
    );
  }

  if (
    template.taskType !==
    expectedTaskType
  ) {
    throw new EmailTemplateRepositoryError(
      "EGA_EMAIL_TEMPLATE_INVALID",
      `Template taskType must be ${expectedTaskType}.`
    );
  }

  if (
    !Array.isArray(
      template.requiredVariables
    ) ||
    template.requiredVariables.some(
      variable =>
        typeof variable !== "string" ||
        variable.trim().length === 0
    )
  ) {
    throw new EmailTemplateRepositoryError(
      "EGA_EMAIL_TEMPLATE_INVALID",
      "requiredVariables must be an array of non-empty strings."
    );
  }

  return {
    templateId:
      requireNonEmptyString(
        template.templateId,
        "templateId"
      ),

    templateVersion:
      template.templateVersion,

    taskType:
      template.taskType,

    subject:
      requireNonEmptyString(
        template.subject,
        "subject"
      ),

    text:
      requireNonEmptyString(
        template.text,
        "text"
      ),

    requiredVariables:
      [...template.requiredVariables]
  };
}

function createFileEmailTemplateRepository(
  options = {}
) {
  const templateDirectory =
    resolve(
      options.templateDirectory ??
      process.env
        .EGA_V9_EMAIL_TEMPLATE_DIRECTORY ??
      join(
        __dirname,
        "../email-templates"
      )
    );

  function loadTemplate(
    taskType
  ) {
    const fileName =
      TEMPLATE_FILE_BY_TASK_TYPE[
        taskType
      ];

    if (!fileName) {
      throw new EmailTemplateRepositoryError(
        "EGA_EMAIL_TEMPLATE_NOT_FOUND",
        `No email template is configured for task type: ${taskType}`
      );
    }

    const filePath =
      join(
        templateDirectory,
        fileName
      );

    if (!existsSync(filePath)) {
      throw new EmailTemplateRepositoryError(
        "EGA_EMAIL_TEMPLATE_NOT_FOUND",
        `Email template file does not exist: ${filePath}`
      );
    }

    const status =
      lstatSync(filePath);

    if (
      status.isSymbolicLink() ||
      !status.isFile()
    ) {
      throw new EmailTemplateRepositoryError(
        "EGA_EMAIL_TEMPLATE_PATH",
        "Email template must be a regular file and must not be a symbolic link."
      );
    }

    let parsed;

    try {
      parsed =
        JSON.parse(
          readFileSync(
            filePath,
            "utf8"
          )
        );
    } catch {
      throw new EmailTemplateRepositoryError(
        "EGA_EMAIL_TEMPLATE_INVALID",
        `Email template contains invalid JSON: ${filePath}`
      );
    }

    return validateTemplate(
      parsed,
      taskType
    );
  }

  return {
    templateDirectory,
    loadTemplate
  };
}

module.exports = {
  EmailTemplateRepositoryError,
  TEMPLATE_FILE_BY_TASK_TYPE,
  createFileEmailTemplateRepository,
  validateTemplate
};
