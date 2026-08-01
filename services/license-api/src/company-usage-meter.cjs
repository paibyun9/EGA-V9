"use strict";

const {
  appendFileSync,
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
  dirname,
  resolve
} = require("node:path");

const {
  randomUUID
} = require("node:crypto");

const USAGE_SCHEMA_VERSION = 1;

const ENVIRONMENTS = new Set([
  "development",
  "production"
]);

const RISK_LEVELS = new Set([
  "standard",
  "high-risk"
]);

const EXECUTION_RESULTS = new Set([
  "allow",
  "deny",
  "contain"
]);

class CompanyUsageMeterError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);

    this.name = "CompanyUsageMeterError";
    this.code = code;
  }
}

function createEmptyAggregateStore() {
  return {
    schemaVersion: USAGE_SCHEMA_VERSION,
    daily: []
  };
}

function requireString(
  value,
  fieldName,
  maxLength = 200
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      `${fieldName} is required.`
    );
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      `${fieldName} exceeds the maximum length of ${maxLength}.`
    );
  }

  return normalized;
}

function parseIsoDate(value, fieldName) {
  const normalized =
    requireString(value, fieldName);

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      `${fieldName} must be a valid ISO-8601 date string.`
    );
  }

  return date;
}

function normalizeUsageEvent(input) {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      "Usage Event must be an object."
    );
  }

  const eventId =
    requireString(
      input.eventId,
      "eventId",
      100
    );

  const occurredAt =
    parseIsoDate(
      input.occurredAt,
      "occurredAt"
    ).toISOString();

  const environment =
    requireString(
      input.environment,
      "environment",
      30
    );

  if (!ENVIRONMENTS.has(environment)) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      "environment must be development or production."
    );
  }

  const riskLevel =
    requireString(
      input.riskLevel,
      "riskLevel",
      30
    );

  if (!RISK_LEVELS.has(riskLevel)) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      "riskLevel must be standard or high-risk."
    );
  }

  const executionResult =
    requireString(
      input.executionResult,
      "executionResult",
      30
    );

  if (
    !EXECUTION_RESULTS.has(
      executionResult
    )
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_EVENT_INVALID",
      "executionResult must be allow, deny, or contain."
    );
  }

  return {
    eventId,
    occurredAt,
    environment,
    riskLevel,
    executionResult,
    sdkVersion:
      requireString(
        input.sdkVersion,
        "sdkVersion",
        50
      )
  };
}

function validateDailyAggregate(record) {
  if (
    typeof record !== "object" ||
    record === null ||
    Array.isArray(record)
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_STORE_CORRUPT",
      "Daily usage aggregate must be an object."
    );
  }

  const integerFields = [
    "totalGovernedExecutions",
    "standardExecutions",
    "highRiskExecutions",
    "allowCount",
    "denyCount",
    "containmentCount"
  ];

  for (const field of integerFields) {
    if (
      !Number.isInteger(record[field]) ||
      record[field] < 0
    ) {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_STORE_CORRUPT",
        `${field} must be a non-negative integer.`
      );
    }
  }

  const countedExecutions =
    record.standardExecutions +
    record.highRiskExecutions;

  if (
    countedExecutions !==
    record.totalGovernedExecutions
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_STORE_CORRUPT",
      "Risk-level counts do not equal totalGovernedExecutions."
    );
  }

  const countedResults =
    record.allowCount +
    record.denyCount +
    record.containmentCount;

  if (
    countedResults !==
    record.totalGovernedExecutions
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_STORE_CORRUPT",
      "Execution-result counts do not equal totalGovernedExecutions."
    );
  }

  return {
    licenseId:
      requireString(
        record.licenseId,
        "licenseId"
      ),

    companyName:
      requireString(
        record.companyName,
        "companyName"
      ),

    date:
      requireString(
        record.date,
        "date",
        10
      ),

    environment:
      requireString(
        record.environment,
        "environment",
        30
      ),

    totalGovernedExecutions:
      record.totalGovernedExecutions,

    standardExecutions:
      record.standardExecutions,

    highRiskExecutions:
      record.highRiskExecutions,

    allowCount:
      record.allowCount,

    denyCount:
      record.denyCount,

    containmentCount:
      record.containmentCount,

    firstEventAt:
      requireString(
        record.firstEventAt,
        "firstEventAt"
      ),

    lastEventAt:
      requireString(
        record.lastEventAt,
        "lastEventAt"
      ),

    updatedAt:
      requireString(
        record.updatedAt,
        "updatedAt"
      )
  };
}

function validateAggregateStore(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.schemaVersion !==
      USAGE_SCHEMA_VERSION ||
    !Array.isArray(value.daily)
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_STORE_CORRUPT",
      "Company Usage Meter store has an unsupported or corrupt structure."
    );
  }

  const daily =
    value.daily.map(
      validateDailyAggregate
    );

  const keys = new Set();

  for (const record of daily) {
    const key = [
      record.licenseId,
      record.date,
      record.environment
    ].join(":");

    if (keys.has(key)) {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_STORE_CORRUPT",
        `Duplicate daily usage aggregate found: ${key}`
      );
    }

    keys.add(key);
  }

  return {
    schemaVersion:
      USAGE_SCHEMA_VERSION,
    daily
  };
}

function assertRegularFile(filePath) {
  const status =
    lstatSync(filePath);

  if (
    status.isSymbolicLink() ||
    !status.isFile()
  ) {
    throw new CompanyUsageMeterError(
      "EGA_USAGE_STORE_PATH",
      "Usage Meter path must be a regular file and must not be a symbolic link."
    );
  }
}

function createFileCompanyUsageMeter(
  options = {}
) {
  const aggregatePath =
    resolve(
      options.aggregatePath ??
      process.env
        .EGA_V9_USAGE_AGGREGATE_PATH ??
      "./data/company-usage-daily.json"
    );

  const eventPath =
    resolve(
      options.eventPath ??
      process.env
        .EGA_V9_USAGE_EVENT_PATH ??
      "./data/company-usage-events.jsonl"
    );

  const seenEventIds =
    new Set();

  function writeAggregateStore(store) {
    const validated =
      validateAggregateStore(store);

    const directoryPath =
      dirname(aggregatePath);

    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    const temporaryPath =
      `${aggregatePath}.tmp-${process.pid}-${randomUUID()}`;

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
        process.platform !== "win32"
      ) {
        chmodSync(
          temporaryPath,
          0o600
        );
      }

      renameSync(
        temporaryPath,
        aggregatePath
      );

      if (
        process.platform !== "win32"
      ) {
        chmodSync(
          aggregatePath,
          0o600
        );
      }
    } finally {
      if (
        existsSync(temporaryPath)
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
    mkdirSync(
      dirname(aggregatePath),
      {
        recursive: true,
        mode: 0o700
      }
    );

    mkdirSync(
      dirname(eventPath),
      {
        recursive: true,
        mode: 0o700
      }
    );

    if (!existsSync(aggregatePath)) {
      writeAggregateStore(
        createEmptyAggregateStore()
      );
    }

    if (!existsSync(eventPath)) {
      writeFileSync(
        eventPath,
        "",
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx"
        }
      );
    }

    if (
      process.platform !== "win32"
    ) {
      chmodSync(
        eventPath,
        0o600
      );
    }

    loadSeenEventIds();

    return {
      aggregatePath,
      eventPath
    };
  }

  function loadSeenEventIds() {
    seenEventIds.clear();

    if (!existsSync(eventPath)) {
      return;
    }

    assertRegularFile(eventPath);

    const lines =
      readFileSync(
        eventPath,
        "utf8"
      )
        .split("\n")
        .filter(Boolean);

    for (const line of lines) {
      let event;

      try {
        event = JSON.parse(line);
      } catch {
        throw new CompanyUsageMeterError(
          "EGA_USAGE_EVENT_STORE_CORRUPT",
          "Usage Event store contains invalid JSON."
        );
      }

      if (
        typeof event.eventId !==
        "string"
      ) {
        throw new CompanyUsageMeterError(
          "EGA_USAGE_EVENT_STORE_CORRUPT",
          "Stored Usage Event is missing eventId."
        );
      }

      if (seenEventIds.has(event.eventId)) {
        throw new CompanyUsageMeterError(
          "EGA_USAGE_EVENT_STORE_CORRUPT",
          `Duplicate stored eventId: ${event.eventId}`
        );
      }

      seenEventIds.add(event.eventId);
    }
  }

  function readAggregateStore() {
    if (!existsSync(aggregatePath)) {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_STORE_UNAVAILABLE",
        "Company Usage Meter aggregate store does not exist."
      );
    }

    assertRegularFile(aggregatePath);

    let parsed;

    try {
      parsed =
        JSON.parse(
          readFileSync(
            aggregatePath,
            "utf8"
          )
        );
    } catch {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_STORE_CORRUPT",
        "Company Usage Meter aggregate store contains invalid JSON."
      );
    }

    return validateAggregateStore(parsed);
  }

  function recordUsageEvent(args) {
    const {
      licenseId,
      companyName,
      event,
      receivedAt = new Date()
    } = args;

    const normalizedEvent =
      normalizeUsageEvent(event);

    if (
      !(receivedAt instanceof Date) ||
      Number.isNaN(
        receivedAt.getTime()
      )
    ) {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_EVENT_INVALID",
        "receivedAt is invalid."
      );
    }

    if (
      seenEventIds.has(
        normalizedEvent.eventId
      )
    ) {
      return {
        created: false,
        eventId:
          normalizedEvent.eventId
      };
    }

    const normalizedLicenseId =
      requireString(
        licenseId,
        "licenseId"
      );

    const normalizedCompanyName =
      requireString(
        companyName,
        "companyName"
      );

    const eventDate =
      normalizedEvent
        .occurredAt
        .slice(0, 10);

    const store =
      readAggregateStore();

    let aggregate =
      store.daily.find(
        record =>
          record.licenseId ===
            normalizedLicenseId &&
          record.date ===
            eventDate &&
          record.environment ===
            normalizedEvent.environment
      );

    if (!aggregate) {
      aggregate = {
        licenseId:
          normalizedLicenseId,

        companyName:
          normalizedCompanyName,

        date:
          eventDate,

        environment:
          normalizedEvent.environment,

        totalGovernedExecutions: 0,
        standardExecutions: 0,
        highRiskExecutions: 0,
        allowCount: 0,
        denyCount: 0,
        containmentCount: 0,

        firstEventAt:
          normalizedEvent.occurredAt,

        lastEventAt:
          normalizedEvent.occurredAt,

        updatedAt:
          receivedAt.toISOString()
      };

      store.daily.push(aggregate);
    }

    aggregate.totalGovernedExecutions += 1;

    if (
      normalizedEvent.riskLevel ===
      "standard"
    ) {
      aggregate.standardExecutions += 1;
    } else {
      aggregate.highRiskExecutions += 1;
    }

    if (
      normalizedEvent.executionResult ===
      "allow"
    ) {
      aggregate.allowCount += 1;
    } else if (
      normalizedEvent.executionResult ===
      "deny"
    ) {
      aggregate.denyCount += 1;
    } else {
      aggregate.containmentCount += 1;
    }

    if (
      normalizedEvent.occurredAt <
      aggregate.firstEventAt
    ) {
      aggregate.firstEventAt =
        normalizedEvent.occurredAt;
    }

    if (
      normalizedEvent.occurredAt >
      aggregate.lastEventAt
    ) {
      aggregate.lastEventAt =
        normalizedEvent.occurredAt;
    }

    aggregate.updatedAt =
      receivedAt.toISOString();

    const storedEvent = {
      schemaVersion:
        USAGE_SCHEMA_VERSION,

      eventId:
        normalizedEvent.eventId,

      licenseId:
        normalizedLicenseId,

      companyName:
        normalizedCompanyName,

      occurredAt:
        normalizedEvent.occurredAt,

      environment:
        normalizedEvent.environment,

      riskLevel:
        normalizedEvent.riskLevel,

      executionResult:
        normalizedEvent.executionResult,

      sdkVersion:
        normalizedEvent.sdkVersion,

      receivedAt:
        receivedAt.toISOString()
    };

    appendFileSync(
      eventPath,
      `${JSON.stringify(storedEvent)}\n`,
      {
        encoding: "utf8"
      }
    );

    try {
      writeAggregateStore(store);
    } catch (error) {
      throw new CompanyUsageMeterError(
        "EGA_USAGE_STORE_WRITE",
        `Usage Event was appended but aggregate update failed: ${
          error instanceof Error
            ? error.message
            : "unknown error"
        }`
      );
    }

    seenEventIds.add(
      normalizedEvent.eventId
    );

    return {
      created: true,
      eventId:
        normalizedEvent.eventId,
      aggregate: {
        ...aggregate,
        highRiskPercentage:
          aggregate
            .totalGovernedExecutions ===
          0
            ? 0
            : (
                aggregate
                  .highRiskExecutions /
                aggregate
                  .totalGovernedExecutions
              ) * 100
      }
    };
  }

  function queryDailyUsage(options = {}) {
    const {
      licenseId,
      startDate,
      endDate,
      environment
    } = options;

    return readAggregateStore()
      .daily
      .filter(record => {
        if (
          licenseId &&
          record.licenseId !==
            licenseId
        ) {
          return false;
        }

        if (
          startDate &&
          record.date < startDate
        ) {
          return false;
        }

        if (
          endDate &&
          record.date > endDate
        ) {
          return false;
        }

        if (
          environment &&
          record.environment !==
            environment
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(
            b.date
          )
      )
      .map(record => ({
        ...record,

        highRiskPercentage:
          record
            .totalGovernedExecutions ===
          0
            ? 0
            : (
                record
                  .highRiskExecutions /
                record
                  .totalGovernedExecutions
              ) * 100
      }));
  }

  function summarizeUsage(options = {}) {
    const daily =
      queryDailyUsage(options);

    const summary = {
      licenseId:
        options.licenseId ??
        null,

      startDate:
        options.startDate ??
        null,

      endDate:
        options.endDate ??
        null,

      environment:
        options.environment ??
        null,

      totalGovernedExecutions: 0,
      standardExecutions: 0,
      highRiskExecutions: 0,
      highRiskPercentage: 0,
      allowCount: 0,
      denyCount: 0,
      containmentCount: 0,
      daily
    };

    for (const record of daily) {
      summary.totalGovernedExecutions +=
        record.totalGovernedExecutions;

      summary.standardExecutions +=
        record.standardExecutions;

      summary.highRiskExecutions +=
        record.highRiskExecutions;

      summary.allowCount +=
        record.allowCount;

      summary.denyCount +=
        record.denyCount;

      summary.containmentCount +=
        record.containmentCount;
    }

    if (
      summary.totalGovernedExecutions >
      0
    ) {
      summary.highRiskPercentage =
        (
          summary.highRiskExecutions /
          summary.totalGovernedExecutions
        ) * 100;
    }

    return summary;
  }

  return {
    aggregatePath,
    eventPath,
    initialize,
    readAggregateStore,
    recordUsageEvent,
    queryDailyUsage,
    summarizeUsage
  };
}

module.exports = {
  USAGE_SCHEMA_VERSION,
  CompanyUsageMeterError,
  createFileCompanyUsageMeter,
  normalizeUsageEvent
};
