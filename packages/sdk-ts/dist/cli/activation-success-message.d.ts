export type EGAActivationSuccessMessageInput = {
    contactName: string;
    companyName: string;
    workEmail: string;
    issuedAt: string;
    expiresAt: string;
};
export declare function buildActivationSuccessMessage(input: EGAActivationSuccessMessageInput): string;
