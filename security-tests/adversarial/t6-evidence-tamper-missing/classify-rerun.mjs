import {
  readFile
} from "node:fs/promises";

const filename =
  process.argv[2];

if (!filename) {
  throw new Error(
    "Usage: node classify-rerun.mjs <raw-result.json>"
  );
}

const result =
  JSON.parse(
    await readFile(
      filename,
      "utf8"
    )
  );

const controlAccepted =
  result.control
    ?.canonicalEvidenceAccepted ===
    true;

const falseSuccessCount =
  result.metrics
    ?.falseSuccessCount ??
  0;

let classification =
  "NOT_VERIFIED";

if (!controlAccepted) {
  classification =
    "NOT_VERIFIED";
} else if (
  falseSuccessCount >
  0
) {
  classification =
    "FAIL";
} else {
  classification =
    "PASS";
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
