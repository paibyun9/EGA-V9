# Security Policy

## Supported Versions

EGA V9 is currently under active development.

| Version | Supported |
|---|---|
| 1.0.x | Planned |
| 0.1.x | Development preview |

The current `0.1.x` release should be treated as a development preview and not as a complete production security boundary.

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately by email:

**contact@lcm3.com**

Do not disclose security vulnerabilities through public GitHub issues, discussions, pull requests, or social-media posts before coordinated review.

A useful vulnerability report should include:

- the affected EGA V9 version or commit;
- the relevant runtime, operating system, and Node.js version;
- a clear description of the suspected issue;
- reproducible steps or a minimal proof of concept;
- the expected and observed behavior;
- potential impact; and
- suggested mitigation, when available.

## Response Process

After receiving a report, the project will attempt to:

1. acknowledge receipt;
2. reproduce and assess the reported behavior;
3. determine the affected components and versions;
4. prepare a remediation or mitigation;
5. coordinate disclosure when appropriate; and
6. publish an updated release and security notice when required.

No fixed response time is guaranteed during the development-preview period.

## Security Scope

EGA V9 provides execution-governance capabilities including deterministic replay, provenance-aware verification, trust-state evaluation, and fail-closed containment.

EGA V9 does not replace:

- foundation-model safety mechanisms;
- identity and access management;
- network and operating-system security;
- infrastructure hardening;
- application-specific authorization;
- cryptographic key management; or
- independent security review.

Security depends on correct integration, policy configuration, trusted deployment infrastructure, and appropriate operational controls.

## Responsible Disclosure

Researchers are asked to provide reasonable time for investigation and remediation before publishing vulnerability details. Good-faith security research and responsible disclosure are welcomed.
