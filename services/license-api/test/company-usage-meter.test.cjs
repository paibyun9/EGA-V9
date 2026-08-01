"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  CompanyUsageMeterError,
  createFileCompanyUsageMeter
} = require(
  "../src/company-usage-meter.cjs"
);

function createEnvironment() {
  const directoryPath =
    mkdtempSync(
      join(
        tmpdir(),
        "ega-v9-usage-meter-"
      )
    );

  const meter =
    createFileCompanyUsageMeter({
      aggregatePath:
        join(
          directoryPath,
          "daily.json"
        ),

      eventPath:
        join(
          directoryPath,
          "events.jsonl"
        )
    });

  meter.initialize();

  return {
    directoryPath,
    meter
  };
}

function cleanup(directoryPath) {
  rmSync(
    directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

function createEvent(overrides = {}) {
  return {
    eventId:
      "event-001",

    occurredAt:
      "2026-08-01T10:00:00.000Z",

    environment:
      "production",

    riskLevel:
      "standard",

    executionResult:
      "allow",

    sdkVersion:
      "1.0.1",

    ...overrides
  };
}

test(
  "initializes private Usage Meter files",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      if (
        process.platform !==
        "win32"
      ) {
        assert.equal(
          statSync(
            meter.aggregatePath
          ).mode & 0o777,
          0o600
        );

        assert.equal(
          statSync(
            meter.eventPath
          ).mode & 0o777,
          0o600
        );
      }
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "records a standard governed execution",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      const result =
        meter.recordUsageEvent({
          licenseId:
            "eval_usage_001",

          companyName:
            "LCM",

          event:
            createEvent(),

          receivedAt:
            new Date(
              "2026-08-01T10:00:01.000Z"
            )
        });

      assert.equal(
        result.created,
        true
      );

      assert.equal(
        result.aggregate
          .totalGovernedExecutions,
        1
      );

      assert.equal(
        result.aggregate
          .standardExecutions,
        1
      );

      assert.equal(
        result.aggregate
          .highRiskExecutions,
        0
      );

      assert.equal(
        result.aggregate
          .allowCount,
        1
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "aggregates standard, high-risk, deny, and containment results",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      const events = [
        createEvent({
          eventId:
            "event-001"
        }),

        createEvent({
          eventId:
            "event-002",
          occurredAt:
            "2026-08-01T11:00:00.000Z",
          riskLevel:
            "high-risk",
          executionResult:
            "deny"
        }),

        createEvent({
          eventId:
            "event-003",
          occurredAt:
            "2026-08-01T12:00:00.000Z",
          riskLevel:
            "high-risk",
          executionResult:
            "contain"
        })
      ];

      for (const event of events) {
        meter.recordUsageEvent({
          licenseId:
            "eval_usage_001",
          companyName:
            "LCM",
          event
        });
      }

      const summary =
        meter.summarizeUsage({
          licenseId:
            "eval_usage_001",
          startDate:
            "2026-08-01",
          endDate:
            "2026-08-31",
          environment:
            "production"
        });

      assert.equal(
        summary
          .totalGovernedExecutions,
        3
      );

      assert.equal(
        summary.standardExecutions,
        1
      );

      assert.equal(
        summary.highRiskExecutions,
        2
      );

      assert.equal(
        summary.denyCount,
        1
      );

      assert.equal(
        summary.containmentCount,
        1
      );

      assert.equal(
        summary.highRiskPercentage,
        (2 / 3) * 100
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "does not count the same eventId twice",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      const first =
        meter.recordUsageEvent({
          licenseId:
            "eval_usage_001",
          companyName:
            "LCM",
          event:
            createEvent()
        });

      const second =
        meter.recordUsageEvent({
          licenseId:
            "eval_usage_001",
          companyName:
            "LCM",
          event:
            createEvent()
        });

      assert.equal(
        first.created,
        true
      );

      assert.equal(
        second.created,
        false
      );

      assert.equal(
        meter
          .summarizeUsage({
            licenseId:
              "eval_usage_001"
          })
          .totalGovernedExecutions,
        1
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "keeps development and production usage separate",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      meter.recordUsageEvent({
        licenseId:
          "eval_usage_001",
        companyName:
          "LCM",
        event:
          createEvent({
            eventId:
              "production-event"
          })
      });

      meter.recordUsageEvent({
        licenseId:
          "eval_usage_001",
        companyName:
          "LCM",
        event:
          createEvent({
            eventId:
              "development-event",
            environment:
              "development"
          })
      });

      assert.equal(
        meter
          .summarizeUsage({
            licenseId:
              "eval_usage_001",
            environment:
              "production"
          })
          .totalGovernedExecutions,
        1
      );

      assert.equal(
        meter
          .summarizeUsage({
            licenseId:
              "eval_usage_001",
            environment:
              "development"
          })
          .totalGovernedExecutions,
        1
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "stores no prompt or execution payload",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      meter.recordUsageEvent({
        licenseId:
          "eval_usage_001",
        companyName:
          "LCM",
        event:
          createEvent()
      });

      const stored =
        readFileSync(
          meter.eventPath,
          "utf8"
        );

      assert.equal(
        stored.includes("prompt"),
        false
      );

      assert.equal(
        stored.includes(
          "toolArguments"
        ),
        false
      );

      assert.equal(
        stored.includes(
          "executionPayload"
        ),
        false
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);

test(
  "rejects unsupported usage dimensions",
  () => {
    const {
      directoryPath,
      meter
    } = createEnvironment();

    try {
      assert.throws(
        () =>
          meter.recordUsageEvent({
            licenseId:
              "eval_usage_001",
            companyName:
              "LCM",
            event:
              createEvent({
                riskLevel:
                  "critical"
              })
          }),
        error =>
          error instanceof
            CompanyUsageMeterError &&
          error.code ===
            "EGA_USAGE_EVENT_INVALID"
      );
    } finally {
      cleanup(directoryPath);
    }
  }
);
