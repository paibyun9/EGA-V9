# EGA V9 --- Execution Governance AI

## Deterministic Runtime Governance for Autonomous AI Workflows

> **Official Replication Guide for the EGA V9 paper**

EGA V9 is an execution-governance framework for deterministic replay,
provenance-aware verification, trust-state evaluation, and fail-closed
containment in autonomous AI workflows.

This README serves as the official replication guide accompanying the
EGA V9 paper.

------------------------------------------------------------------------

## Table of Contents

1.  Why EGA V9?
2.  Installation
3.  Three-Line Integration
4.  Quick Start
5.  Expected Output
6.  Reproducing the Paper
7.  Publication Verification
8.  Runtime Architecture
9.  Repository Structure
10. Contact and Collaboration
11. License
12. Roadmap

------------------------------------------------------------------------

## 1. Why EGA V9?

Autonomous AI systems require deterministic runtime governance rather
than probabilistic execution trust.

EGA V9 introduces four governance primitives:

-   Deterministic Replay
-   Provenance-aware Verification
-   Trust-State Evaluation
-   Fail-Closed Containment

------------------------------------------------------------------------

## 2. Installation

``` bash
npm install ega-v9
```

Repository replication:

``` bash
git clone https://github.com/paibyun9/EGA-V9.git
cd EGA-V9
npm ci
```

------------------------------------------------------------------------

## 3. Three-Line Integration

Apply EGA execution governance before protected routes.

```javascript
const { ega } = require("ega-v9");

app.use(ega.guard());

The middleware verifies the workflow before the application route executes.
Replay mismatches are fail-closed contained and do not reach the protected
route.
```
------------------------------------------------------------------------

## 4. Quick Start

Verify a workflow with a single function call.

Create quick-start.cjs
```javascript
const { verifyExecution } = require("ega-v9");

const workflow = [
  {
    step: 1,
    action: "search_product",
    item: "Laptop"
  },
  {
    step: 2,
    action: "checkout_request"
  }
];

const result = verifyExecution(workflow);

console.log(result);
```
Run
```bash
node quick-start.cjs
```
Expected Output
```json
{
  "status": "verified",
  "replayConsistency": true,
  "trustState": "T1",
  "containmentRequired": false,
  "executionAllowed": true
}
```
------------------------------------------------------------------------

## 5. Expected Output

A verified workflow confirms deterministic replay, preserves workflow integrity, and allows execution without containment. When the replay path matches the original execution, EGA confirms workflow integrity, keeps the trust state at **T1**, and allows execution without containment.

```json
{
  "status": "verified",
  "replayConsistency": true,
  "trustState": "T1",
  "containmentRequired": false,
  "executionAllowed": true
}
```

Field | Meaning
------|--------
`status` | Overall verification result.
`replayConsistency` | Confirms that replay reproduced the identical execution path.
`trustState` | Current runtime trust level (`T1` = verified).
`containmentRequired` | Indicates whether fail-closed containment is required.
`executionAllowed` | Whether the workflow is permitted to continue.
A verified workflow returns deterministic execution results.

------------------------------------------------------------------------

## 6. Reproducing the Paper

Regenerate the benchmark artifacts and verify that the repository reproduces the deterministic results reported in the EGA V9 paper.

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Benchmark

```bash
npm run table4:build
```

### Publication Verification

```bash
npm run stage-c:gate
npm run stage-d:gate
npm run release:all-gates
```

Successful execution regenerates the publication artifacts, validates repository consistency, and confirms that the benchmark results remain reproducible.

------------------------------------------------------------------------

## 7. Publication Verification


Validate the complete publication pipeline by running each release gate in sequence.

### Stage A — Repository Validation

```bash
npm run release:gate
```

### Stage B — Build Validation

```bash
npm run stage-b:gate
```

### Stage C — Documentation Validation

```bash
npm run stage-c:gate
```

### Stage D — Benchmark Validation

```bash
npm run stage-d:gate
```

### Stage E — Publication Validation

```bash
npm run stage-e:gate
```

### Live Publication Verification

After all public artifacts (GitHub, npm, Vercel, paper, and documentation) are published, run the live consistency check.

```bash
npm run stage-e:live
```

Successful completion confirms that the repository, benchmark artifacts, documentation, and public publication assets are internally consistent and ready for release.

------------------------------------------------------------------------

## 8. Runtime Architecture

``` text
Workflow
   │
   ▼
TypeScript SDK
   │
   ▼
Runtime Governance Core
   ├── Deterministic Replay
   ├── Provenance Verification
   ├── Trust-State Evaluation
   └── Fail-Closed Containment
   │
   ▼
Publication Verification
```

------------------------------------------------------------------------

## 9. Repository Structure

``` text
EGA-V9/
├── benchmarks/
├── crates/
├── dashboard/
├── docs/
├── packages/sdk-ts/
├── paper/generated/
├── publication/
├── scripts/
├── package.json
├── SECURITY.md
├── LICENSE
└── README.md
```

------------------------------------------------------------------------

## 10. Contact and Collaboration

contact@lcm3.com

Feedback from researchers, developers, startups, and enterprise
engineering teams is welcome.

------------------------------------------------------------------------

## 11. License

Released under the MIT License.

------------------------------------------------------------------------

## 12. Roadmap

Current development:

-   Complete README replication guide
-   Finalize SDK
-   Finalize benchmark reproducibility
-   Finalize Stage E
-   Release v1.0.0

------------------------------------------------------------------------

## Release Integrity Principle

> Do not trust a published result merely because it appears in a paper.
> Reproduce the benchmark, regenerate the publication artifact, and
> verify the release gates.
