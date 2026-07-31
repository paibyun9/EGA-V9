"use strict";

class EmailTemplateRendererError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "EmailTemplateRendererError";

    this.code =
      code;
  }
}

function formatDate(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new EmailTemplateRendererError(
      "EGA_EMAIL_TEMPLATE_VARIABLE",
      "expiresAt must contain a valid date."
    );
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function createTemplateVariables(
  task
) {
  return {
    contactName:
      task.contactName,

    companyName:
      task.companyName,

    workEmail:
      task.workEmail,

    issuedDate:
      formatDate(
        task.issuedAt
      ),

    expiresDate:
      formatDate(
        task.expiresAt
      ),

    licenseId:
      task.licenseId
  };
}

function renderString(
  source,
  variables
) {
  const rendered =
    source.replace(
      /\{\{([A-Za-z0-9_]+)\}\}/g,
      (
        _match,
        variableName
      ) => {
        if (
          !Object.prototype
            .hasOwnProperty.call(
              variables,
              variableName
            )
        ) {
          throw new EmailTemplateRendererError(
            "EGA_EMAIL_TEMPLATE_VARIABLE",
            `Unknown template variable: ${variableName}`
          );
        }

        const value =
          variables[
            variableName
          ];

        if (
          typeof value !== "string" ||
          value.length === 0
        ) {
          throw new EmailTemplateRendererError(
            "EGA_EMAIL_TEMPLATE_VARIABLE",
            `Template variable is empty: ${variableName}`
          );
        }

        return value;
      }
    );

  const unresolved =
    rendered.match(
      /\{\{[^}]+\}\}/
    );

  if (unresolved) {
    throw new EmailTemplateRendererError(
      "EGA_EMAIL_TEMPLATE_VARIABLE",
      `Unresolved template variable: ${unresolved[0]}`
    );
  }

  return rendered;
}

function renderEmailTemplate(
  template,
  task
) {
  const variables =
    createTemplateVariables(
      task
    );

  for (
    const requiredVariable of
    template.requiredVariables
  ) {
    if (
      typeof variables[
        requiredVariable
      ] !== "string" ||
      variables[
        requiredVariable
      ].length === 0
    ) {
      throw new EmailTemplateRendererError(
        "EGA_EMAIL_TEMPLATE_VARIABLE",
        `Required variable is unavailable: ${requiredVariable}`
      );
    }
  }

  return {
    to:
      task.workEmail,

    subject:
      renderString(
        template.subject,
        variables
      ),

    text:
      renderString(
        template.text,
        variables
      ),

    templateId:
      template.templateId,

    templateVersion:
      template.templateVersion
  };
}

module.exports = {
  EmailTemplateRendererError,
  createTemplateVariables,
  renderEmailTemplate,
  renderString
};
