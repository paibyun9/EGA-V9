export type EGAUpgradeCommandOptions = {
    apiBaseUrl?: string;
    writeLine?: (value: string) => void;
};
export declare function runUpgradeCommand(options?: EGAUpgradeCommandOptions): Promise<number>;
