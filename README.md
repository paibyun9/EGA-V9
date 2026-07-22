# EGA V9 --- Execution Governance AI

## Deterministic Runtime Governance for Autonomous AI Workflows

> **Official Replication Guide for the EGA V9 paper**

EGA V9 is an execution-governance framework for deterministic replay,
provenance-aware verification, trust-state evaluation, and fail-closed
containment in autonomous AI workflows.

This README serves as the official replication guide accompanying the
EGA V9 paper.

------------------------------------------------------------------------

## 1. Are You Facing These Problems?

☐ AI agent tool calls cannot be verified.

☐ Agent execution cannot be replayed.

☐ State corruption is difficult to diagnose.

☐ Workflow failures are hard to reproduce.

☐ Prompt injection leaves little audit evidence.

☐ Multi-agent execution becomes a black box.

------------------------------------------------------------------------

## 2. EGA V9 Solves These Problems

✓ Replay Verification

✓ Runtime Governance

✓ Trust-State Evaluation

✓ Fail-Closed Containment

✓ Execution Provenance

------------------------------------------------------------------------

## 3. Works With

✓ LangChain + EGA V9

✓ OpenAI Agents SDK + EGA V9

✓ CrewAI + EGA V9

✓ AutoGen + EGA V9

✓ MCP Tool Server + EGA V9

> **Note;**
>
> **EGA V9 complements your existing agent framework—it does not replace it.**
>
> Keep your orchestration logic, prompts, and tool definitions.
> EGA adds deterministic runtime verification underneath.

------------------------------------------------------------------------

## 4. Runtime Architecture

| Existing Stack | Existing Stack + EGA |
|----------------|----------------------|
| **LangChain / Framework** | **LangChain / Framework** |
| ↓ | ↓ |
| **Your Agent** | **Your Agent** |
| ↓ | ↓ |
| **LLM / External Tools**<br><sub>Black Box</sub> | **EGA Runtime Governance Layer** |
|  | ├─ Replay Verification |
|  | ├─ Runtime Governance |
|  | ├─ Trust-State Evaluation |
|  | ├─ Fail-Closed Containment |
|  | └─ Execution Provenance |
|  | ↓ |
|  | **LLM / External Tools** |

> **No framework migration. No prompt rewrite. No workflow redesign.**  
> **Just add EGA Runtime Governance.**

```javascript
const { ega } = require("ega-v9");

app.use(ega.guard());
```
**Existing Stack + One Runtime Governance Layer = Deterministic AI Execution**

------------------------------------------------------------------------

## 5. Quick Start

Get EGA V9 running in less than one minute.

### 1). Install

```bash
npm install ega-v9
```

---

### 2). Create a Quick Start Example

Create `quick-start.cjs` and paste the following code.

```javascript
// 기존 Quick Start 코드 그대로
```

---

### 3). Run

```bash
node quick-start.cjs
```

---

### 4). Expected Output

A successful execution verifies deterministic replay, evaluates the workflow
trust state, and confirms that no containment action is required.

```json

{
  "status": "verified",
  "replayConsistency": true,
  "trustState": "T1",
  "containmentRequired": false,
  "executionAllowed": true
}
<img width="468" height="172" alt="image" src="https://github.com/user-attachments/assets/07349ba1-8130-4405-a806-3dfda865cd45" />

```

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

Feedback from researchers, developers, startups, and enterprise engineering teams is welcome.

### Community Support
- GitHub Issues (Questions, Bug Reports, Feature Requests, Documentation Feedback, and Independent Reproducibility Reports): https://github.com/paibyun9/EGA-V9/issues

### Project Resources
- Live Vercel Demo: https://ega-v9.vercel.app/
- Official Project Website: https://lcm3.com/

### Direct Contact
- contact@lcm3.com

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
