# SCORP LOCK #4 — Core Engine Change Protection

## Purpose

SCORP LOCK #4 protects the EGA V9 core engine from unauthorized, accidental, or rushed modification.

The goal is not only to record who changed the core engine, but to prevent core engine changes from being merged without review, delay, and explicit approval.

## Protected Core Files

- packages/sdk-ts/src/index.ts
- crates/runtime-core/src/lib.rs
- package.json
- packages/sdk-ts/package.json
- .github/workflows/*
- .github/CODEOWNERS
- SECURITY.md
- security/*

## Required Governance Rule

Any change to protected core files must go through:

1. Pull Request only
2. Automated test verification
3. CODEOWNER review
4. 24-hour cooling period
5. Explicit SCORP approval label
6. Manual merge only

## Required Approval Label

A core engine change PR must include:

scorp-lock-approved

## Required Waiting Period

Core engine PRs must remain open for at least 24 hours before merge.

## Security Principle

No direct core mutation.

No silent engine modification.

No unreviewed runtime governance change.

## V9 Alpha Rule

SCORP LOCK #4 is implemented as repository governance.

It does not modify runtime behavior.

## V10 Expansion

In V10, this can expand into:

- signed releases
- protected npm publishing
- two-person approval
- enterprise audit trail
- incident notification
- release attestation
