import {
  EGALicense,
  EGALicenseEvaluation
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(
  value: string,
  fieldName: string
): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      `Invalid ${fieldName}: expected an ISO-8601 date string.`
    );
  }

  return date;
}

export function evaluateCommercialLicense(
  license: EGALicense,
  now: Date = new Date()
): EGALicenseEvaluation {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      "Invalid current date."
    );
  }

  if (license.licenseKind === "commercial") {
    if (!license.expiresAt) {
      return {
        licenseKind: "commercial",
        status: "active",
        executionAllowed: true,
        daysRemaining: null,
        reminderDue: false,
        sevenDayWarningDue: false,
        reason: "Commercial License is active."
      };
    }

    const expiresAt = parseDate(
      license.expiresAt,
      "expiresAt"
    );

    const remainingMilliseconds =
      expiresAt.getTime() - now.getTime();

    const daysRemaining = Math.max(
      0,
      Math.ceil(
        remainingMilliseconds / DAY_MS
      )
    );

    if (remainingMilliseconds <= 0) {
      return {
        licenseKind: "commercial",
        status: "expired",
        executionAllowed: false,
        daysRemaining: 0,
        reminderDue: false,
        sevenDayWarningDue: false,
        reason: "Commercial License has expired."
      };
    }

    return {
      licenseKind: "commercial",
      status:
        daysRemaining <= 7
          ? "expiring"
          : "active",
      executionAllowed: true,
      daysRemaining,
      reminderDue: false,
      sevenDayWarningDue:
        daysRemaining <= 7,
      reason: "Commercial License is active."
    };
  }

  const issuedAt = parseDate(
    license.issuedAt,
    "issuedAt"
  );

  const expiresAt = parseDate(
    license.expiresAt,
    "expiresAt"
  );

  if (
    expiresAt.getTime() <=
    issuedAt.getTime()
  ) {
    throw new TypeError(
      "Evaluation License expiresAt must be later than issuedAt."
    );
  }

  const remainingMilliseconds =
    expiresAt.getTime() - now.getTime();

  const daysRemaining = Math.max(
    0,
    Math.ceil(
      remainingMilliseconds / DAY_MS
    )
  );

  if (remainingMilliseconds <= 0) {
    return {
      licenseKind: "evaluation",
      status: "expired",
      executionAllowed: false,
      daysRemaining: 0,
      reminderDue: false,
      sevenDayWarningDue: false,
      reason:
        "The 90-day Evaluation License has expired. A Commercial License is required."
    };
  }

  const elapsedDays = Math.floor(
    (
      now.getTime() -
      issuedAt.getTime()
    ) / DAY_MS
  );

  return {
    licenseKind: "evaluation",
    status:
      daysRemaining <= 7
        ? "expiring"
        : "active",
    executionAllowed: true,
    daysRemaining,
    reminderDue:
      elapsedDays >= 60,
    sevenDayWarningDue:
      daysRemaining <= 7,
    reason:
      daysRemaining <= 7
        ? `Evaluation License expires in ${daysRemaining} day(s).`
        : "Evaluation License is active."
  };
}
