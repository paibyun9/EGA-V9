import {
  assertRuntimeLicenseAdmission
} from "./runtime-admission";

export type EGARuntimeAdmissionProvider =
  () => void;

let runtimeAdmissionProvider:
  EGARuntimeAdmissionProvider =
    () => {
      assertRuntimeLicenseAdmission();
    };

export function enforceRuntimeLicenseAdmission(): void {
  runtimeAdmissionProvider();
}

/**
 * Internal test-only dependency boundary.
 *
 * This function is not exported from the public SDK root.
 * It must never be connected to an environment-variable bypass.
 */
export function setRuntimeAdmissionProviderForTesting(
  provider:
    EGARuntimeAdmissionProvider
): () => void {
  if (
    typeof provider !==
    "function"
  ) {
    throw new TypeError(
      "Runtime Admission test provider must be a function."
    );
  }

  const previousProvider =
    runtimeAdmissionProvider;

  runtimeAdmissionProvider =
    provider;

  return () => {
    runtimeAdmissionProvider =
      previousProvider;
  };
}
