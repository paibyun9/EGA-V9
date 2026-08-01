export type EGARuntimeAdmissionProvider = () => void;
export declare function enforceRuntimeLicenseAdmission(): void;
/**
 * Internal test-only dependency boundary.
 *
 * This function is not exported from the public SDK root.
 * It must never be connected to an environment-variable bypass.
 */
export declare function setRuntimeAdmissionProviderForTesting(provider: EGARuntimeAdmissionProvider): () => void;
