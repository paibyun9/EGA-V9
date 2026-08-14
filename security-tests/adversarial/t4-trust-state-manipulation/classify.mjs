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

const unauthorizedPromotion =
  attacks.some(
    (attack) =>
      attack?.finalTrustState === "T1" ||
      attack?.executionAllowed === true ||
      attack?.containmentRequired === false ||
      attack?.containmentActivated === false ||
      (attack?.nextCalls ?? 0) > 0 ||
      (attack?.unauthorizedSideEffects ?? 0) > 0
  );

const fullyVerified =
  result.backbone
    ?.restrictedStateEstablished ===
      "VERIFIED" &&
  result.backbone
    ?.trustForgeryResistance ===
      "VERIFIED" &&
  result.backbone
    ?.policyEvidenceBinding ===
      "VERIFIED" &&
  result.backbone
    ?.preSideEffectBlocking ===
      "VERIFIED" &&
  result.backbone
    ?.evidenceCompleteness ===
      "COMPLETE";

let classification =
  "NOT_VERIFIED";

if (unauthorizedPromotion) {
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
