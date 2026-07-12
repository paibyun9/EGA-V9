# EGA V9 Runtime Architecture

EGA V9 separates runtime governance, developer integration, benchmarking, demonstration, and publication verification.

## Architecture Flow

```text
Autonomous Workflow
        |
        v
TypeScript SDK
        |
        v
Runtime Governance Core
        |
        +-- Deterministic Replay
        +-- Provenance Verification
        +-- Trust-State Evaluation
        +-- Fail-Closed Containment
        |
        v
Verification Evidence
        |
        +-- Benchmark Artifacts
        +-- Generated Paper Tables
        +-- Dashboard and Demo
        |
        v
Publication Verification Gates
Main Locations
Runtime core: crates/
TypeScript SDK: packages/sdk-ts/
Benchmarks: benchmarks/
Dashboard: dashboard/
Generated publication artifacts: paper/generated/
Publication manifest: publication/manifest.json
Release gate scripts: scripts/
