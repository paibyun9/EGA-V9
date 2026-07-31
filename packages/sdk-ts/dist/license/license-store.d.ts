export type EGALicenseStoreOptions = {
    /**
     * Optional explicit directory.
     *
     * Primarily used for tests and controlled deployments.
     */
    baseDirectory?: string;
    /**
     * Optional platform override.
     *
     * Primarily used for tests.
     */
    platform?: NodeJS.Platform;
    /**
     * Optional home-directory override.
     *
     * Primarily used for tests.
     */
    homeDirectory?: string;
    /**
     * Optional environment-variable override.
     *
     * Primarily used for tests.
     */
    environment?: NodeJS.ProcessEnv;
};
export type EGASaveLicenseOptions = EGALicenseStoreOptions & {
    overwrite?: boolean;
};
export declare class EGALicenseStoreError extends Error {
    readonly code: "EGA_LICENSE_STORE_KEY" | "EGA_LICENSE_STORE_EXISTS" | "EGA_LICENSE_STORE_PATH" | "EGA_LICENSE_STORE_READ" | "EGA_LICENSE_STORE_WRITE";
    constructor(code: EGALicenseStoreError["code"], message: string);
}
export declare function resolveEvaluationLicensePath(options?: EGALicenseStoreOptions): string;
export declare function saveEvaluationLicenseKey(evaluationLicenseKey: string, options?: EGASaveLicenseOptions): string;
export declare function readEvaluationLicenseKey(options?: EGALicenseStoreOptions): string | null;
export declare function deleteEvaluationLicenseKey(options?: EGALicenseStoreOptions): boolean;
