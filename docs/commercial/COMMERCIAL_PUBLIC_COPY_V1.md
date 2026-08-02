# EGA V9 Commercial Public Copy V1

Status: SCORP LOCK

This document is the canonical public-language source for the EGA V9
Evaluation and Commercial License flow.

## Core Public Statement

EGA V9 provides a 90-day Enterprise Evaluation License.

No credit card is required to begin the evaluation.

Activate the evaluation after installation:

```bash
npx ega-v9 register

The Evaluation License permits governed execution for 90 days.

At the end of the evaluation period, EGA V9 governed execution stops
until a Commercial License is activated.

Request or activate a Commercial License:

npx ega-v9 upgrade

Commercial terms are determined case by case according to the customer's
deployment scope, governed execution volume, risk profile, support needs,
and operating environment.

Company Usage Measurement

EGA V9 may record approved company-level operational measurements:

Total Governed Executions
Standard Executions
High-Risk Executions
High-Risk Percentage
ALLOW Count
DENY Count
Containment Count
Development and Production environment
Daily and selected-period usage trends

This measurement system is not an automatic billing engine.

Pricing is not calculated by the SDK.

Prohibited Customer Data

The EGA V9 Company Usage Meter must not collect:

Prompt content
Tool arguments
Execution payloads
Account or card numbers
Transaction details
Customer documents
Internal policy text
Evaluation Lifecycle
Day 0: Evaluation License activated
Day 60: Commercial review period begins
Day 83: Seven-day expiration warning becomes due
Day 90: Evaluation License expires and governed execution stops
Commercial activation: Governed execution continues under the Commercial License
Email Statement

Lifecycle notification infrastructure is included in EGA V9.

Public documentation must not claim that production email delivery is
active until a real Email Provider has been connected and verified.

Commercial Contact

Email: contact@lcm3.com

Public Terminology

Use:

Evaluation License
Evaluation License Key
Commercial License
Governed Execution
Company Usage Meter

Do not expose these internal terms as customer-facing product names:

Token
JWT
Signing algorithm
Private signing key
Internal notification queue
