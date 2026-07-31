#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("readline/promises");
const process_1 = require("process");
const register_command_1 = require("./register-command");
const license_api_client_1 = require("./license-api-client");
const license_key_1 = require("../license/license-key");
const public_key_1 = require("../license/public-key");
const license_store_1 = require("../license/license-store");
function printHelp() {
    console.log([
        "EGA V9 CLI",
        "",
        "Usage:",
        "  ega-v9 register",
        "  ega-v9 --help",
        "",
        "Commands:",
        "  register    Activate a 90-day Evaluation License"
    ].join("\n"));
}
async function main() {
    const command = process.argv[2];
    if (command === "--help" ||
        command === "-h" ||
        !command) {
        printHelp();
        return;
    }
    if (command !== "register") {
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exitCode = 1;
        return;
    }
    const apiBaseUrl = process.env
        .EGA_V9_LICENSE_API_URL ??
        "https://lcm3.com";
    const publicKey = (0, public_key_1.loadEvaluationLicensePublicKey)();
    const licenseApi = (0, license_api_client_1.createLicenseApiClient)({
        baseUrl: apiBaseUrl
    });
    const readline = (0, promises_1.createInterface)({
        input: process_1.stdin,
        output: process_1.stdout
    });
    try {
        await (0, register_command_1.runRegisterCommand)({
            ask: async (question) => readline.question(question),
            issueEvaluationLicense: input => licenseApi
                .issueEvaluationLicense(input),
            verifyEvaluationLicenseKey: evaluationLicenseKey => (0, license_key_1.verifyEvaluationLicenseKey)(evaluationLicenseKey, publicKey),
            saveEvaluationLicenseKey: (evaluationLicenseKey, options) => (0, license_store_1.saveEvaluationLicenseKey)(evaluationLicenseKey, options),
            write: message => console.log(message)
        });
    }
    finally {
        readline.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error
        ? error.message
        : "Unexpected EGA V9 CLI error.");
    process.exitCode = 1;
});
