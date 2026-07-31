export type EGALicenseKind =
  | "evaluation"
  | "commercial";

export type EGALicenseStatus =
  | "active"
  | "expiring"
  | "expired"
  | "suspended";

export type EGAEvaluationLicense = {
  schemaVersion: 1;
  licenseKind: "evaluation";
  licenseId: string;
  contactName: string;
  companyName: string;
  workEmail: string;
  issuedAt: string;
  expiresAt: string;
};

export type EGACommercialLicense = {
  schemaVersion: 1;
  licenseKind: "commercial";
  licenseId: string;
  contactName: string;
  companyName: string;
  workEmail: string;
  issuedAt: string;
  expiresAt?: string;
};

export type EGALicense =
  | EGAEvaluationLicense
  | EGACommercialLicense;

export type EGALicenseEvaluation = {
  licenseKind: EGALicenseKind;
  status: EGALicenseStatus;
  executionAllowed: boolean;
  daysRemaining: number | null;
  reminderDue: boolean;
  sevenDayWarningDue: boolean;
  reason: string;
};
