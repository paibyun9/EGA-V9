# EGA V9 Commercial License Runtime Policy V1

Status: SCORP LOCK

## Purpose

EGA V9 provides a 90-day Evaluation License so that users can evaluate the complete product before making a commercial decision.

The Evaluation License exists to:

1. Prevent indefinite free commercial use.
2. Create a clear commercial conversion point.

## Registration

The user activates the evaluation through:

```bash
npx ega-v9 register

Required information:

Contact Name
Company Name
Work Email
Official Evaluation Message

Welcome to EGA V9

Activate your 90-day Evaluation License.

No credit card required.

Contact Name:
Company Name:
Work Email:

[ Activate Evaluation ]

Evaluation Period
Day 0: Evaluation License issued
Day 60: Commercial License reminder
Day 83: Seven-day expiration warning
Day 90: Evaluation expires
Expiration

After Day 90, EGA V9 must not permit continued runtime use unless a valid Commercial License has been activated.

Terminology

User-facing materials must use:

Evaluation License
Evaluation License Key
Commercial License

User-facing materials must not expose internal implementation terms such as token, JWT, signing algorithm, or encryption format.

Architectural Boundary

The licensing layer controls whether the EGA V9 runtime may be entered.

It must remain separate from the governance core:

Replay
Trust
Verification
Provenance
Containment

Licensing behavior must not alter deterministic governance results.

Change Rule

This policy is the implementation authority for Commercial License Runtime V1.

Any change requires a separate design review and explicit approval.
