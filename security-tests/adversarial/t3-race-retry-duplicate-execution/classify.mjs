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

const attacks =
  Object.values(
    result.attacks ?? {}
  );

const duplicateObserved =
  attacks.some(
    (attack) =>
      (attack?.duplicateSideEffects ?? 0) > 0 ||
      (attack?.duplicatePurchaseExecutions ?? 0) > 0 ||
      (attack?.duplicateToolExecutions ?? 0) > 0 ||
      (attack?.totalSideEffects ?? 0) > 1
  );

const fullyVerified =
  result.control
    ?.totalSideEffects === 1 &&
  result.backbone
    ?.singleExecutionBinding ===
      "VERIFIED" &&
  result.backbone
    ?.duplicateSuppression ===
      "VERIFIED" &&
  result.backbone
    ?.raceSafety ===
      "VERIFIED" &&
  result.backbone
    ?.retrySafety ===
      "VERIFIED" &&
  result.backbone
    ?.evidenceCompleteness ===
      "COMPLETE";

let classification =
  "NOT_VERIFIED";

if (duplicateObserved) {
  classification =
    "FAIL";
} else if (fullyVerified) {
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
