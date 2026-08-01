"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildActivationRequiredMessage = buildActivationRequiredMessage;
function buildActivationRequiredMessage() {
    return [
        "EGA V9 is installed but not activated.",
        "",
        "Activate your FREE 90-Day Evaluation License.",
        "No credit card required.",
        "",
        "Run:",
        "",
        "    npx ega-v9 register"
    ].join("\n");
}
