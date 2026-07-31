"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createFileEmailTemplateRepository
} = require(
  "../src/email-template-repository.cjs"
);

const {
  renderEmailTemplate
} = require(
  "../src/email-template-renderer.cjs"
);

function task() {
  return {
    taskType:
      "day60-commercial-reminder",

    licenseId:
      "eval_template_001",

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
  };
}

test(
  "loads and renders the current Day 60 email template",
  () => {
    const repository =
      createFileEmailTemplateRepository();

    const template =
      repository.loadTemplate(
        "day60-commercial-reminder"
      );

    const result =
      renderEmailTemplate(
        template,
        task()
      );

    assert.equal(
      result.to,
      "contact@lcm3.com"
    );

    assert.equal(
      result.templateVersion,
      1
    );

    assert.match(
      result.text,
      /Byun DJ/
    );

    assert.match(
      result.text,
      /LCM/
    );

    assert.match(
      result.text,
      /2026-10-30/
    );

    assert.equal(
      result.text.includes(
        "{{"
      ),
      false
    );
  }
);

test(
  "loads all lifecycle email templates",
  () => {
    const repository =
      createFileEmailTemplateRepository();

    for (
      const taskType of [
        "day60-commercial-reminder",
        "day83-expiration-warning",
        "day90-evaluation-expired"
      ]
    ) {
      const template =
        repository
          .loadTemplate(
            taskType
          );

      assert.equal(
        template.taskType,
        taskType
      );
    }
  }
);
