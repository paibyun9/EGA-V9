#!/usr/bin/env node

import {
  createInterface
} from "readline/promises";

import {
  stdin,
  stdout
} from "process";

import {
  runRegisterCommand
} from "./register-command";

import {
  runUpgradeCommand
} from "./upgrade-command";

import {
  createLicenseApiClient
} from "./license-api-client";

import {
  verifyEvaluationLicenseKey
} from "../license/license-key";

import {
  loadEvaluationLicensePublicKey
} from "../license/public-key";

import {
  saveEvaluationLicenseKey
} from "../license/license-store";

function printHelp(): void {
  console.log(
    [
      "EGA V9 CLI",
      "",
      "Usage:",
      "  ega-v9 register",
      "  ega-v9 upgrade",
      "  ega-v9 --help",
      "",
      "Commands:",
      "  register    Activate a 90-day Evaluation License",
      "  upgrade     Request or activate a Commercial License"
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const command =
    process.argv[2];

  if (
    command === "--help" ||
    command === "-h" ||
    !command
  ) {
    printHelp();
    return;
  }

  if (
    command === "upgrade"
  ) {
    const exitCode =
      await runUpgradeCommand();

    process.exitCode =
      exitCode;

    return;
  }

  if (command !== "register") {
    console.error(
      `Unknown command: ${command}`
    );

    printHelp();
    process.exitCode = 1;
    return;
  }

  const apiBaseUrl =
    process.env
      .EGA_V9_LICENSE_API_URL ??
    "https://lcm3.com";

  const publicKey =
    loadEvaluationLicensePublicKey();

  const licenseApi =
    createLicenseApiClient({
      baseUrl:
        apiBaseUrl
    });

  const readline =
    createInterface({
      input: stdin,
      output: stdout
    });

  try {
    await runRegisterCommand({
      ask: async question =>
        readline.question(
          question
        ),

      issueEvaluationLicense:
        input =>
          licenseApi
            .issueEvaluationLicense(
              input
            ),

      verifyEvaluationLicenseKey:
        evaluationLicenseKey =>
          verifyEvaluationLicenseKey(
            evaluationLicenseKey,
            publicKey
          ),

      saveEvaluationLicenseKey:
        (
          evaluationLicenseKey,
          options
        ) =>
          saveEvaluationLicenseKey(
            evaluationLicenseKey,
            options
          ),

      write: message =>
        console.log(message)
    });
  } finally {
    readline.close();
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Unexpected EGA V9 CLI error."
    );

    process.exitCode = 1;
  }
);
