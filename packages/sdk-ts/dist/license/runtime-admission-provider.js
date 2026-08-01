"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceRuntimeLicenseAdmission = enforceRuntimeLicenseAdmission;
exports.setRuntimeAdmissionProviderForTesting = setRuntimeAdmissionProviderForTesting;
const runtime_admission_1 = require("./runtime-admission");
let runtimeAdmissionProvider = () => {
    (0, runtime_admission_1.assertRuntimeLicenseAdmission)();
};
function enforceRuntimeLicenseAdmission() {
    runtimeAdmissionProvider();
}
/**
 * Internal test-only dependency boundary.
 *
 * This function is not exported from the public SDK root.
 * It must never be connected to an environment-variable bypass.
 */
function setRuntimeAdmissionProviderForTesting(provider) {
    if (typeof provider !==
        "function") {
        throw new TypeError("Runtime Admission test provider must be a function.");
    }
    const previousProvider = runtimeAdmissionProvider;
    runtimeAdmissionProvider =
        provider;
    return () => {
        runtimeAdmissionProvider =
            previousProvider;
    };
}
