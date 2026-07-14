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
- Average verification latency: **~0.0018 ms**
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

```ts
app.post("/checkout", async (req) => {
  await agent.buy(req.body.item);
});
```

### After

```js
const { ega } = require("ega-v9");

app.use(ega.guard());
```

A verified request continues to the protected route. A replay mismatch is fail-closed contained before the protected operation is executed.

------------------------------------------------------------------------

## 4. Quick Start

Create `server.cjs`:

```js
const express = require("express");
const {
  ega
} = require("ega-v9");

const app = express();

app.use(express.json());
app.use(ega.guard());

app.post(
  "/checkout",
  (req, res) => {
    res.json({
      checkoutAccepted: true
    });
  }
);

app.listen(
  3000,
  () => {
    console.log(
      "EGA V9 example listening on port 3000"
    );
  }
);

Run:

```bash
node server.cjs
```

---

## 5. Verified Behavior


Run:

```bash
node server.cjs
```
```bash
node server.cjs
```
---

## 5. Verified Behavior

The official Express integration tests verify the following behavior.

A normal workflow is verified and allowed:

```json
{
  "statusCode": 200,
  "checkoutAccepted": true,
  "verified": true,
  "containmentRequired": false,
  "executionAllowed": true
}
```

A replay mismatch is fail-closed contained:

```json
{
  "statusCode": 403,
  "checkoutAccepted": false,
  "detectionStatus": "mismatch",
  "verified": false,
  "containmentRequired": true,
  "executionAllowed": false
}
```

Latency values are omitted because they vary across execution environments. Publication performance results are reported separately in the benchmark artifacts.

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
