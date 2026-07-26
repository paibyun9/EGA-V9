"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const repoRoot = process.cwd();

const outputDir = path.join(
  repoRoot,
  "publication",
  "evidence",
  "v1.0.1",
);

const auditDir = path.join(
  repoRoot,
  "audit",
  "v1.0.1",
);

const outputJson = path.join(
  outputDir,
  "seven-test-verification-baseline.json",
);

const outputText = path.join(
  auditDir,
  "seven-test-verification-baseline.txt",
);

const suites = [
  {
    id: "tool-order-mutation",
    name: "Tool Order Mutation",
    file: "publication/evidence/tool-order/tool-order-mutation-evidence.json",
  },
  {
    id: "approval-bypass",
    name: "Approval Bypass",
    file: "publication/evidence/approval-bypass/approval-bypass-evidence.json",
  },
  {
    id: "tool-injection",
    name: "Tool Injection",
    file: "publication/evidence/tool-injection/tool-injection-evidence.json",
  },
  {
    id: "replay-root-verification",
    name: "Replay Root Verification",
    file: "publication/evidence/replay-root/replay-root-change-evidence.json",
  },
  {
    id: "workflow-divergence",
    name: "Workflow Divergence Verification",
    file: "publication/evidence/workflow-divergence/workflow-divergence-evidence.json",
  },
  {
    id: "trust-state-escalation",
    name: "Trust-State Escalation",
    file: "publication/evidence/trust-state/trust-state-escalation-evidence.json",
  },
  {
    id: "fail-closed-containment",
    name: "Fail-Closed Containment",
    file: "publication/evidence/fail-closed-containment/fail-closed-containment-evidence.json",
  },
];

const explicitStatusKeys = new Set([
  "status",
  "result",
  "verdict",
  "outcome",
  "finalstatus",
  "finalresult",
  "overallstatus",
  "overallresult",
  "verificationstatus",
  "teststatus",
  "gate",
]);

const positiveStatusValues = new Set([
  "pass",
  "passed",
  "success",
  "successful",
  "ok",
  "verified",
  "valid",
  "complete",
  "completed",
]);

const negativeStatusValues = new Set([
  "fail",
  "failed",
  "failure",
  "error",
  "blocked",
  "invalid",
  "incomplete",
  "rejected",
]);

const positiveBooleanKeyPattern =
  /(?:^|[_-])(pass|passed|success|successful|verified|valid|detected|blocked|contained|matched|activated|escalated|stopped|denied)(?:$|[_-])/i;

const negativeBooleanKeyPattern =
  /(?:^|[_-])(fail|failed|failure|error|diverged|mismatch|leak|vulnerability|unsafe|allowed|bypassed)(?:$|[_-])/i;

function normalize(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  return {
    command: [command, ...args].join(" "),
    exitCode:
      typeof result.status === "number"
        ? result.status
        : 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function walkScalars(value, currentPath = "$", results = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkScalars(item, `${currentPath}[${index}]`, results);
    });

    return results;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    for (const [key, child] of Object.entries(value)) {
      walkScalars(
        child,
        `${currentPath}.${key}`,
        results,
      );
    }

    return results;
  }

  const finalKey = currentPath
    .split(".")
    .at(-1)
    .replace(/\[\d+\]/g, "");

  results.push({
    path: currentPath,
    key: finalKey,
    value,
    type:
      value === null
        ? "null"
        : typeof value,
  });

  return results;
}

function classifySignals(scalars) {
  const positive = [];
  const negative = [];
  const informational = [];

  for (const scalar of scalars) {
    const normalizedKey = normalize(scalar.key);
    const normalizedValue = normalize(scalar.value);

    if (
      explicitStatusKeys.has(normalizedKey) &&
      positiveStatusValues.has(normalizedValue)
    ) {
      positive.push({
        ...scalar,
        reason: "explicit-positive-status",
      });

      continue;
    }

    if (
      explicitStatusKeys.has(normalizedKey) &&
      negativeStatusValues.has(normalizedValue)
    ) {
      negative.push({
        ...scalar,
        reason: "explicit-negative-status",
      });

      continue;
    }

    if (
      typeof scalar.value === "boolean" &&
      positiveBooleanKeyPattern.test(scalar.key)
    ) {
      if (scalar.value === true) {
        positive.push({
          ...scalar,
          reason: "positive-boolean-true",
        });
      } else {
        negative.push({
          ...scalar,
          reason: "positive-boolean-false",
        });
      }

      continue;
    }

    if (
      typeof scalar.value === "boolean" &&
      negativeBooleanKeyPattern.test(scalar.key)
    ) {
      if (scalar.value === true) {
        negative.push({
          ...scalar,
          reason: "negative-condition-true",
        });
      } else {
        positive.push({
          ...scalar,
          reason: "negative-condition-false",
        });
      }

      continue;
    }

    if (
      typeof scalar.value === "string" &&
      positiveStatusValues.has(normalizedValue)
    ) {
      informational.push({
        ...scalar,
        reason: "unscoped-positive-string",
      });

      continue;
    }

    if (
      typeof scalar.value === "string" &&
      negativeStatusValues.has(normalizedValue)
    ) {
      negative.push({
        ...scalar,
        reason: "negative-string",
      });
    }
  }

  return {
    positive,
    negative,
    informational,
  };
}

function evaluateSuite(suite) {
  const absolutePath = path.join(repoRoot, suite.file);

  if (!fs.existsSync(absolutePath)) {
    return {
      ...suite,
      status: "FAIL",
      reason: "Evidence file is missing.",
      exists: false,
      parsePass: false,
      sha256: null,
      positiveSignals: [],
      negativeSignals: [],
      informationalSignals: [],
      ignoredSignals: [],
      topLevelKeys: [],
    };
  }

  const raw = fs.readFileSync(absolutePath);

  let parsed;

  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    return {
      ...suite,
      status: "FAIL",
      reason: `Invalid JSON: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
      exists: true,
      parsePass: false,
      sha256: sha256(raw),
      positiveSignals: [],
      negativeSignals: [],
      informationalSignals: [],
      ignoredSignals: [],
      topLevelKeys: [],
    };
  }

  const scalars = walkScalars(parsed);
  const signals = classifySignals(scalars);

  const ignoredSignals = [];
  const effectiveNegativeSignals = [];

  for (const signal of signals.negative) {
    const isApprovalMutationInput =
      suite.id === "approval-bypass" &&
      signal.value === false &&
      (
        signal.path ===
          "$.approvalStates.bypassed.required" ||
        signal.path ===
          "$.bypassed.observed.responseBody.ega.provenance.nodes[0].data.body.approval.required"
      );

    if (isApprovalMutationInput) {
      ignoredSignals.push({
        ...signal,
        ignoredBecause:
          "Approval Bypass mutation intentionally sets approval.required=false.",
      });

      continue;
    }

    effectiveNegativeSignals.push(signal);
  }

  const explicitFinalStatus =
    typeof parsed?.finalStatus === "string"
      ? parsed.finalStatus.trim().toUpperCase()
      : null;

  const suitePassFields = [];

  if (parsed?.approved?.pass === true) {
    suitePassFields.push("$.approved.pass");
  }

  if (parsed?.bypassed?.pass === true) {
    suitePassFields.push("$.bypassed.pass");
  }

  let status;
  let reason;

  if (
    explicitFinalStatus &&
    explicitFinalStatus !== "PASS"
  ) {
    status = "FAIL";
    reason =
      `Evidence finalStatus is ${explicitFinalStatus}, not PASS.`;
  } else if (effectiveNegativeSignals.length > 0) {
    status = "FAIL";
    reason =
      `${effectiveNegativeSignals.length} effective negative signal(s) found.`;
  } else if (
    suite.id === "approval-bypass" &&
    explicitFinalStatus === "PASS" &&
    suitePassFields.length === 2
  ) {
    status = "PASS";
    reason =
      "Approval Bypass contract passed: approved.pass=true, bypassed.pass=true, finalStatus=PASS; intentional required=false mutation fields were ignored.";
  } else if (
    explicitFinalStatus === "PASS"
  ) {
    status = "PASS";
    reason =
      "Explicit finalStatus=PASS and no effective negative signals found.";
  } else if (signals.positive.length > 0) {
    status = "PASS";
    reason =
      `${signals.positive.length} explicit positive signal(s) found and no effective negative signals found.`;
  } else {
    status = "AMBIGUOUS";
    reason =
      "No explicit suite-level PASS/FAIL result could be proven.";
  }

  return {
    ...suite,
    status,
    reason,
    exists: true,
    parsePass: true,
    sizeBytes: raw.length,
    sha256: sha256(raw),
    topLevelKeys:
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? Object.keys(parsed).sort()
        : [],
    scalarCount: scalars.length,
    explicitFinalStatus,
    suitePassFields,
    positiveSignals: signals.positive,
    negativeSignals: effectiveNegativeSignals,
    ignoredSignals,
    informationalSignals: signals.informational,
  };
}

fs.mkdirSync(outputDir, {
  recursive: true,
});

fs.mkdirSync(auditDir, {
  recursive: true,
});

const results = suites.map(evaluateSuite);

const passed = results.filter(
  (result) => result.status === "PASS",
).length;

const failed = results.filter(
  (result) => result.status === "FAIL",
).length;

const ambiguous = results.filter(
  (result) => result.status === "AMBIGUOUS",
).length;

const total = results.length;

const finalStatus =
  passed === total &&
  failed === 0 &&
  ambiguous === 0
    ? "PASS"
    : "BLOCKED";

const gitBranch = run("git", [
  "branch",
  "--show-current",
]);

const latestCommit = run("git", [
  "log",
  "-1",
  "--oneline",
]);

const summary = {
  schemaVersion: "1.0.0",
  releaseTarget: "ega-v9@1.0.1",
  gateId: "seven-test-verification-baseline",
  generatedAt: new Date().toISOString(),

  repository: {
    branch: gitBranch.stdout,
    latestCommit: latestCommit.stdout,
  },

  policy: {
    requiredTests: 7,
    requiredPasses: 7,
    ambiguousEvidenceAllowed: false,
    negativeEvidenceAllowed: false,
    releaseAllowedOnlyWhenFinalStatusPass: true,
  },

  totals: {
    total,
    passed,
    failed,
    ambiguous,
  },

  finalStatus,
  releaseAllowed: finalStatus === "PASS",
  results,
};

fs.writeFileSync(
  outputJson,
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

const lines = [];

lines.push("EGA V9@1.0.1");
lines.push("Seven-Test Verification Baseline");
lines.push("================================");
lines.push("");

for (const result of results) {
  lines.push(
    `${result.status.padEnd(9)} ${result.name}`,
  );

  lines.push(`  Evidence: ${result.file}`);
  lines.push(`  Reason:   ${result.reason}`);

  if (result.sha256) {
    lines.push(`  SHA-256:  ${result.sha256}`);
  }

  if (result.negativeSignals.length > 0) {
    lines.push("  Negative signals:");

    for (const signal of result.negativeSignals) {
      lines.push(
        `    - ${signal.path} = ${JSON.stringify(signal.value)} (${signal.reason})`,
      );
    }
  }

  if (
    result.status === "AMBIGUOUS" &&
    result.informationalSignals.length > 0
  ) {
    lines.push("  Informational signals:");

    for (const signal of result.informationalSignals.slice(0, 10)) {
      lines.push(
        `    - ${signal.path} = ${JSON.stringify(signal.value)}`,
      );
    }
  }

  lines.push("");
}

lines.push("--------------------------------");
lines.push(`Total:     ${total}`);
lines.push(`Passed:    ${passed}`);
lines.push(`Failed:    ${failed}`);
lines.push(`Ambiguous: ${ambiguous}`);
lines.push(`Final:     ${finalStatus}`);
lines.push(
  `Release:   ${
    summary.releaseAllowed
      ? "ALLOWED"
      : "BLOCKED"
  }`,
);
lines.push("");
lines.push(
  `JSON evidence: ${path.relative(repoRoot, outputJson)}`,
);

const textReport = `${lines.join("\n")}\n`;

fs.writeFileSync(
  outputText,
  textReport,
  "utf8",
);

process.stdout.write(textReport);

if (finalStatus !== "PASS") {
  process.exitCode = 1;
}
