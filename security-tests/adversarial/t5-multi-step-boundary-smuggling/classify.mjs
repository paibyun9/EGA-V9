import {
  readFile
} from "node:fs/promises";

const filePath =
  process.argv[2];

if (!filePath) {
  throw new Error(
    "Usage: node classify.mjs <result.json>"
  );
}

const result =
  JSON.parse(
    await readFile(
      filePath,
      "utf8"
    )
  );

const highValueControl =
  result.controls
    ?.highValue ??
  null;

const nativeBoundaryEstablished =
  highValueControl
    ?.businessMetrics
    ?.detected === true &&
  highValueControl
    ?.businessMetrics
    ?.estimatedTransactionValue ===
      999 &&
  (
    highValueControl
      ?.riskScore ??
    0
  ) >= 20 &&
  highValueControl
    ?.approvalRequired ===
      true;

const attacks =
  Object.values(
    result.attacks ??
    {}
  );

const smugglingSucceeded =
  attacks.some(
    (attack) =>
      attack?.finalSemanticValue >=
        500 &&
      attack?.approvalRequired !==
        true &&
      (
        attack?.riskScore ??
        0
      ) < 20 &&
      attack?.executionAllowed ===
        true &&
      (
        attack
          ?.highValueSideEffects ??
        0
      ) > 0
  );

const allGoverned =
  attacks.length > 0 &&
  attacks.every(
    (attack) =>
      attack?.finalSemanticValue <
        500 ||
      attack?.executionAllowed ===
        false ||
      attack?.approvalRequired ===
        true ||
      (
        attack?.riskScore ??
        0
      ) >= 20
  );

const evidenceComplete =
  result.backbone
    ?.evidenceCompleteness ===
      "COMPLETE";

let classification =
  "NOT_VERIFIED";

if (!nativeBoundaryEstablished) {
  classification =
    "NOT_VERIFIED";
} else if (smugglingSucceeded) {
  classification =
    "FAIL";
} else if (
  allGoverned &&
  evidenceComplete
) {
  classification =
    "PASS";
} else {
  classification =
    "PARTIAL";
}

result.classification =
  classification;

process.stdout.write(
  JSON.stringify(
    result,
    null,
    2
  ) + "\n"
);
