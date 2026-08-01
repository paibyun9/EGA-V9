export type EGAActivationSuccessMessageInput = {
  contactName: string;
  companyName: string;
  workEmail: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildActivationSuccessMessage(
  input: EGAActivationSuccessMessageInput
): string {
  return [
    "",
    "✓ Evaluation License Activated",
    "",
    `Contact Name: ${input.contactName}`,
    `Company Name: ${input.companyName}`,
    `Work Email:   ${input.workEmail}`,
    "",
    `Issued:  ${input.issuedAt}`,
    `Expires: ${input.expiresAt}`,
    "",
    "✓ EGA V9 is now activated.",
    "",
    "You can start using Runtime Governance immediately.",
    "",
    "Need help or want to collaborate?",
    "",
    "Community Support",
    "",
    "GitHub Issues",
    "https://github.com/paibyun9/EGA-V9/issues",
    "",
    "Use GitHub Issues for questions, bug reports,",
    "feature requests, documentation feedback,",
    "and independent reproducibility reports.",
    "",
    "Project Resources",
    "",
    "Live Demo",
    "https://ega-v9.vercel.app/",
    "",
    "Official Website",
    "https://lcm3.com/",
    ""
  ].join("\n");
}
