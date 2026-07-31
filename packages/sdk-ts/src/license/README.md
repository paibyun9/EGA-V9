# EGA V9 Commercial Licensing Layer

This directory contains the Evaluation and Commercial License runtime.

The licensing layer must remain separate from the deterministic governance core.

Responsibilities:

- Evaluation License registration
- Evaluation License Key verification
- Issue-date and expiration-date validation
- Evaluation status calculation
- Commercial License activation
- Fail-closed runtime admission

The licensing layer must not modify replay, trust, verification, provenance, or containment results.
