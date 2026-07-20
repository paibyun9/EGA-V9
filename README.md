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
5. [Verified Behavior](#5-verified-behavior)
6.  Reproducing the Paper
7.  Publication Verification
8.  Runtime Architecture
9.  Repository Structure
10. Contact and Collaboration
11. License
12. Roadmap

------------------------------------------------------------------------

## 1. Why EGA V9?

**LLM-based guards add cost. Runtime failures still happen.**

EGA V9 takes a different approach.

Instead of asking another LLM whether an execution is safe, EGA V9 verifies workflow execution deterministically.

### EGA V9

- Runtime verification with **0 additional LLM calls**
- Median (P50) verification latency: **0.003055 ms**
- **10,000 workflows evaluated**
- **0% false positives / 0% false negatives**
- Deterministic replay, provenance verification, and fail-closed containment

> **Deterministic Replay > Probabilistic Trust**

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

Protect an existing AI application with a single middleware.

### Before

```javascript
app.post("/checkout", async (req) => {
  await agent.buy(req.body.item);
});
```

### After

```javascript
const { ega } = require("ega-v9");

app.use(ega.guard());
```

A verified request proceeds to the protected route. A replay mismatch is fail-closed contained before the protected operation is executed.

------------------------------------------------------------------------

## 4. Quick Start

Create a file named `quick-start.cjs`.

```javascript
const { verifyExecution } = require("ega-v9");

const workflow = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    quantity: 1
  },
  {
    step: 3,
    action: "checkout_request",
    approved: true
  }
];

const result = verifyExecution(workflow);

console.log({
  status: result.status,
  replayConsistency:
    result.detection.status === "match",
  trustState:
    result.trust.currentTier,
  containmentRequired:
    result.containment.activated &&
    !result.containment.executionAllowed,
  executionAllowed:
    result.containment.executionAllowed
});
```

Run:

```bash
node quick-start.cjs
```

Expected output:

```text
{
  status: 'verified',
  replayConsistency: true,
  trustState: 'T1',
  containmentRequired: false,
  executionAllowed: true
}
```

---

## 5. Verified Behavior

The Quick Start example demonstrates deterministic runtime verification.

```text
{
  status: 'verified',
  replayConsistency: true,
  trustState: 'T1',
  containmentRequired: false,
  executionAllowed: true
}
```

This output demonstrates that:

- ✅ Replay consistency is verified.
- ✅ The workflow remains in Trust State **T1**.
- ✅ No containment is required.
- ✅ Execution is allowed.

These results were verified using the published EGA V9 Release Candidate package.

------------------------------------------------------------------------

## 6. Reproducing the Paper

The complete replication workflow used in the EGA V9 paper is available here:

→ Detailed guide → **[Reproducing the Paper](docs/REPRODUCING_THE_PAPER.md)**

This guide explains how to:

- Build the SDK
- Run the benchmark
- Regenerate Table 4
- Execute all publication verification gates
- Reproduce the paper artifacts

------------------------------------------------------------------------

## 7. Publication Verification

The complete publication verification workflow is documented here.

Detailed guide → **[Publication Verification](docs/PUBLICATION_VERIFICATION.md)**

------------------------------------------------------------------------

## 8. Runtime Architecture

The complete EGA V9 runtime architecture is documented here.

Detailed guide → **[Runtime Architecture](docs/RUNTIME_ARCHITECTURE.md)**

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
