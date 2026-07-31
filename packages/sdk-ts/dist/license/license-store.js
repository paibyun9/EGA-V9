"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGALicenseStoreError = void 0;
exports.resolveEvaluationLicensePath = resolveEvaluationLicensePath;
exports.saveEvaluationLicenseKey = saveEvaluationLicenseKey;
exports.readEvaluationLicenseKey = readEvaluationLicenseKey;
exports.deleteEvaluationLicenseKey = deleteEvaluationLicenseKey;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const crypto_1 = require("crypto");
const LICENSE_FILE_NAME = "evaluation-license.key";
const LICENSE_KEY_PATTERN = /^EGA9-LIC-V1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_LICENSE_KEY_BYTES = 64 * 1024;
class EGALicenseStoreError extends Error {
    constructor(code, message) {
        super(`[${code}] ${message}`);
        this.name =
            "EGALicenseStoreError";
        this.code =
            code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EGALicenseStoreError = EGALicenseStoreError;
function validateEvaluationLicenseKey(evaluationLicenseKey) {
    if (typeof evaluationLicenseKey !==
        "string" ||
        evaluationLicenseKey.trim().length === 0) {
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_KEY", "Evaluation License Key is required.");
    }
    const normalizedKey = evaluationLicenseKey.trim();
    if (Buffer.byteLength(normalizedKey, "utf8") > MAX_LICENSE_KEY_BYTES) {
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_KEY", "Evaluation License Key exceeds the maximum supported size.");
    }
    if (!LICENSE_KEY_PATTERN.test(normalizedKey)) {
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_KEY", "Evaluation License Key has an unsupported format.");
    }
    return normalizedKey;
}
function resolveLicenseDirectory(options = {}) {
    if (typeof options.baseDirectory ===
        "string" &&
        options.baseDirectory.trim().length > 0) {
        return options.baseDirectory;
    }
    const platform = options.platform ??
        process.platform;
    const homeDirectory = options.homeDirectory ??
        (0, os_1.homedir)();
    const environment = options.environment ??
        process.env;
    if (platform === "win32") {
        const appData = environment.APPDATA?.trim();
        return (0, path_1.join)(appData ||
            (0, path_1.join)(homeDirectory, "AppData", "Roaming"), "ega-v9");
    }
    if (platform === "darwin") {
        return (0, path_1.join)(homeDirectory, "Library", "Application Support", "ega-v9");
    }
    const xdgConfigHome = environment.XDG_CONFIG_HOME?.trim();
    return (0, path_1.join)(xdgConfigHome ||
        (0, path_1.join)(homeDirectory, ".config"), "ega-v9");
}
function resolveEvaluationLicensePath(options = {}) {
    return (0, path_1.join)(resolveLicenseDirectory(options), LICENSE_FILE_NAME);
}
function assertSafeExistingFile(filePath) {
    const fileStatus = (0, fs_1.lstatSync)(filePath);
    if (fileStatus.isSymbolicLink() ||
        !fileStatus.isFile()) {
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_PATH", "Evaluation License path must be a regular file and must not be a symbolic link.");
    }
}
function saveEvaluationLicenseKey(evaluationLicenseKey, options = {}) {
    const normalizedKey = validateEvaluationLicenseKey(evaluationLicenseKey);
    const filePath = resolveEvaluationLicensePath(options);
    const directoryPath = (0, path_1.dirname)(filePath);
    try {
        (0, fs_1.mkdirSync)(directoryPath, {
            recursive: true,
            mode: 0o700
        });
        if (process.platform !== "win32") {
            (0, fs_1.chmodSync)(directoryPath, 0o700);
        }
        if ((0, fs_1.existsSync)(filePath)) {
            assertSafeExistingFile(filePath);
            if (!options.overwrite) {
                throw new EGALicenseStoreError("EGA_LICENSE_STORE_EXISTS", "An Evaluation License Key is already stored. Explicit overwrite approval is required.");
            }
        }
        const temporaryPath = `${filePath}.tmp-${process.pid}-${(0, crypto_1.randomUUID)()}`;
        try {
            (0, fs_1.writeFileSync)(temporaryPath, `${normalizedKey}\n`, {
                encoding: "utf8",
                mode: 0o600,
                flag: "wx"
            });
            if (process.platform !==
                "win32") {
                (0, fs_1.chmodSync)(temporaryPath, 0o600);
            }
            if (options.overwrite &&
                (0, fs_1.existsSync)(filePath)) {
                (0, fs_1.rmSync)(filePath, {
                    force: true
                });
            }
            (0, fs_1.renameSync)(temporaryPath, filePath);
            if (process.platform !==
                "win32") {
                (0, fs_1.chmodSync)(filePath, 0o600);
            }
        }
        finally {
            if ((0, fs_1.existsSync)(temporaryPath)) {
                (0, fs_1.rmSync)(temporaryPath, {
                    force: true
                });
            }
        }
        return filePath;
    }
    catch (error) {
        if (error instanceof
            EGALicenseStoreError) {
            throw error;
        }
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_WRITE", `Unable to store the Evaluation License Key: ${error instanceof Error
            ? error.message
            : "unknown error"}`);
    }
}
function readEvaluationLicenseKey(options = {}) {
    const filePath = resolveEvaluationLicensePath(options);
    if (!(0, fs_1.existsSync)(filePath)) {
        return null;
    }
    try {
        assertSafeExistingFile(filePath);
        const fileStatus = (0, fs_1.statSync)(filePath);
        if (fileStatus.size >
            MAX_LICENSE_KEY_BYTES) {
            throw new EGALicenseStoreError("EGA_LICENSE_STORE_KEY", "Stored Evaluation License Key exceeds the maximum supported size.");
        }
        const storedKey = (0, fs_1.readFileSync)(filePath, "utf8");
        return validateEvaluationLicenseKey(storedKey);
    }
    catch (error) {
        if (error instanceof
            EGALicenseStoreError) {
            throw error;
        }
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_READ", `Unable to read the Evaluation License Key: ${error instanceof Error
            ? error.message
            : "unknown error"}`);
    }
}
function deleteEvaluationLicenseKey(options = {}) {
    const filePath = resolveEvaluationLicensePath(options);
    if (!(0, fs_1.existsSync)(filePath)) {
        return false;
    }
    try {
        assertSafeExistingFile(filePath);
        (0, fs_1.rmSync)(filePath, {
            force: true
        });
        return true;
    }
    catch (error) {
        if (error instanceof
            EGALicenseStoreError) {
            throw error;
        }
        throw new EGALicenseStoreError("EGA_LICENSE_STORE_WRITE", `Unable to delete the Evaluation License Key: ${error instanceof Error
            ? error.message
            : "unknown error"}`);
    }
}
