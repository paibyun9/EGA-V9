import { EGAEvaluationLicense } from "../license/types";
export type EGARegistrationInput = {
    contactName: string;
    companyName: string;
    workEmail: string;
};
export type EGARegistrationResponse = {
    evaluationLicenseKey: string;
};
export type EGARegisterCommandDependencies = {
    ask: (question: string) => Promise<string>;
    issueEvaluationLicense: (input: EGARegistrationInput) => Promise<EGARegistrationResponse>;
    verifyEvaluationLicenseKey: (evaluationLicenseKey: string) => EGAEvaluationLicense;
    saveEvaluationLicenseKey: (evaluationLicenseKey: string, options?: {
        overwrite?: boolean;
    }) => string;
    write: (message: string) => void;
    overwrite?: boolean;
};
export type EGARegisterCommandResult = {
    license: EGAEvaluationLicense;
    licensePath: string;
};
export declare class EGARegisterCommandError extends Error {
    readonly code: "EGA_REGISTER_INPUT" | "EGA_REGISTER_SERVICE" | "EGA_REGISTER_RESPONSE";
    constructor(code: EGARegisterCommandError["code"], message: string);
}
export declare function runRegisterCommand(dependencies: EGARegisterCommandDependencies): Promise<EGARegisterCommandResult>;
