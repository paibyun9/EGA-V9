const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateCommercialLicense
} = require("../../dist/license/evaluate-license.js");

const evaluationLicense = {
  schemaVersion: 1,
  licenseKind: "evaluation",
  licenseId: "eval_test_001",
  contactName: "Test User",
  companyName: "Test Company",
  workEmail: "test@example.com",
  issuedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-10-30T00:00:00.000Z"
};

test("Day 0: evaluation license is active", () => {
  const result = evaluateCommercialLicense(
    evaluationLicense,
    new Date("2026-08-01T00:00:00.000Z")
  );

  assert.equal(result.licenseKind, "evaluation");
  assert.equal(result.status, "active");
  assert.equal(result.executionAllowed, true);
  assert.equal(result.daysRemaining, 90);
  assert.equal(result.reminderDue, false);
  assert.equal(result.sevenDayWarningDue, false);
});

test("Day 60: commercial reminder becomes due", () => {
  const result = evaluateCommercialLicense(
    evaluationLicense,
    new Date("2026-09-30T00:00:00.000Z")
  );

  assert.equal(result.status, "active");
  assert.equal(result.executionAllowed, true);
  assert.equal(result.daysRemaining, 30);
  assert.equal(result.reminderDue, true);
  assert.equal(result.sevenDayWarningDue, false);
});

test("Day 83: seven-day warning becomes due", () => {
  const result = evaluateCommercialLicense(
    evaluationLicense,
    new Date("2026-10-23T00:00:00.000Z")
  );

  assert.equal(result.status, "expiring");
  assert.equal(result.executionAllowed, true);
  assert.equal(result.daysRemaining, 7);
  assert.equal(result.reminderDue, true);
  assert.equal(result.sevenDayWarningDue, true);
});

test("Day 89: one day remains", () => {
  const result = evaluateCommercialLicense(
    evaluationLicense,
    new Date("2026-10-29T00:00:00.000Z")
  );

  assert.equal(result.status, "expiring");
  assert.equal(result.executionAllowed, true);
  assert.equal(result.daysRemaining, 1);
  assert.equal(result.sevenDayWarningDue, true);
});

test("Day 90: evaluation license expires and execution stops", () => {
  const result = evaluateCommercialLicense(
    evaluationLicense,
    new Date("2026-10-30T00:00:00.000Z")
  );

  assert.equal(result.status, "expired");
  assert.equal(result.executionAllowed, false);
  assert.equal(result.daysRemaining, 0);
  assert.equal(result.reminderDue, false);
  assert.equal(result.sevenDayWarningDue, false);
});

test("commercial license without expiration remains active", () => {
  const result = evaluateCommercialLicense(
    {
      schemaVersion: 1,
      licenseKind: "commercial",
      licenseId: "commercial_test_001",
      contactName: "Test User",
      companyName: "Test Company",
      workEmail: "test@example.com",
      issuedAt: "2026-08-01T00:00:00.000Z"
    },
    new Date("2028-08-01T00:00:00.000Z")
  );

  assert.equal(result.licenseKind, "commercial");
  assert.equal(result.status, "active");
  assert.equal(result.executionAllowed, true);
  assert.equal(result.daysRemaining, null);
});

test("invalid evaluation date range throws", () => {
  assert.throws(
    () =>
      evaluateCommercialLicense(
        {
          ...evaluationLicense,
          expiresAt: evaluationLicense.issuedAt
        },
        new Date("2026-08-01T00:00:00.000Z")
      ),
    /expiresAt must be later than issuedAt/
  );
});
