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
**Existing Stack + One Runtime Governance Layer = Deterministic Governance for AI Execution**

------------------------------------------------------------------------

## 5. Quick Start

Get EGA V9 running in less than one minute.

### 1). Install

```bash
npm install ega-v9
```

---

### 2). Create a Quick Start Example

Create a file named `quick-start.cjs`, paste the following code, and save it.

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

console.log({
  status: result.status,
  trustState: result.trust.currentTier,
  executionAllowed: result.containment.executionAllowed,
  containmentActivated: result.containment.activated
});
```

### 3). Run

```bash
node quick-start.cjs
```

### 4). Expected Output

```json
{
  status: 'verified',
  trustState: 'T1',
  executionAllowed: true,
  containmentActivated: false
}
```

### Runtime Compatibility

| Environment | Status |
|-------------|--------|
| CommonJS | ✅ Verified |
| ESM | ✅ Verified |
| TypeScript | ✅ Verified |
| Express | ✅ Verified |
| npm install | ✅ Verified |
| npm audit | ✅ Clean |

*Verified during the official v1.0.1 clean-consumer release validation.

------------------------------------------------------------------------

## 6. Why Adopt EGA V9?

### Build trustworthy AI workflows without sacrificing speed, cost, or simplicity.

- ⚡ **Fast** — Runtime verification in milliseconds.
- 💰 **Near-Zero Cost** — Runtime verification without external LLM or API calls.
- 🚀 **Simple** — Integrate with just a few lines of code.
- 🔒 **Secure** — Protect AI workflows with deterministic governance and fail-closed execution.

### Built for Production

- **Replay** — Reconstruct every workflow exactly.
- **Auditability** — Generate cryptographically verifiable runtime evidence.
- **Runtime Verification** — Detect execution inconsistencies.
- **Deterministic Governance** — Govern AI with predictable decisions.
- **Fail-Closed Execution** — Automatically contain unsafe workflows.

------------------------------------------------------------------------

## 7. Verify EGA V9 Before Adoption

> **Don't trust our claims. Verify them yourself.**

Run the governance validation suite locally and verify the core runtime governance properties of EGA V9 using the same SDK implementation included in this repository.

---

### 1). Clone the Repository

```bash
git clone https://github.com/paibyun9/EGA-V9.git
cd EGA-V9
npm ci
```

---

### 2). Run the Governance Validation Suite

Validate the seven core governance and runtime-integrity properties.

```bash
# 1. Deterministic Replay Root Verification
npm run test:replay-root

# 2. Workflow Divergence Detection
npm run test:workflow-divergence

# 3. Trust-State Escalation
npm run test:trust-state

# 4. Fail-Closed Containment
npm run test:fail-closed

# 5. Tool Invocation Order Integrity
npm run test:tool-order

# 6. Approval Bypass Defense
npm run test:approval-bypass

# 7. Workflow-Level Tool Injection Detection
npm run test:tool-injection
```

> **Note**
>
> - All validation runs locally.
> - Zero external API calls.
> - Deterministic execution.
> - Each test automatically generates reproducible JSON and Markdown evidence files.

---

### 3). Review the Evidence

Validation artifacts are generated automatically under:

```text
publication/evidence/
```

Artifacts include:

- JSON report
- Markdown report
- Final PASS / FAIL status

---

### Expected Validation Results

| Validation | Expected Result |
|------------|:---------------:|
| Replay Root Verification | ✅ PASS |
| Workflow Divergence Detection | ✅ PASS |
| Trust-State Escalation | ✅ PASS |
| Fail-Closed Containment | ✅ PASS |
| Tool Order Integrity | ✅ PASS |
| Approval Bypass Defense | ✅ PASS |
| Workflow-Level Tool Injection Detection | ✅ PASS |


**We don't hide problems. We solve them together.**

------------------------------------------------------------------------

## 8. Enterprise Evaluation

The next step is to evaluate how EGA V9 fits into a real enterprise AI workflow.

### Step 1). Company Policy

Before evaluating EGA V9, define the policies that your AI system must follow.

**Example: AI Shopping Policy**

| Workflow | Company Policy |
|----------|----------------|
| Purchase | Payment must be completed before shipment. |
| Refund | Refunds are allowed within 30 days and require manager approval. |
| Return | Product inspection is required before approval. |

**Example Policy Configuration**

```json
{
  "purchase": {
    "paymentRequired": true
  },
  "refund": {
    "managerApproval": true
  }
}
```

* Illustrative example only. Actual policy integration depends on your application architecture.

---

### Step 2). Integrate EGA V9

Install EGA V9.

```bash
npm install ega-v9
```

Integrate EGA V9 into your AI workflow.

```text
Customer → AI Shopping Agent (e.g., LangChain)
         → Company Policy
         → [ EGA V9 ]
         → Inventory API | Payment API | Refund API | Shipping API
```

EGA V9 enforces company policies before workflow execution while recording deterministic governance evidence.

---

### Step 3). Governed Workflow Execution

**Standard Order Pipeline**

```text
Customer Order → Agent → [ EGA V9 ] → Payment API → PASS
```

**Policy-Enforced Refund Pipeline**

```text
Refund Request → Agent → Manager Approval → [ EGA V9 ] → Refund API → PASS
```

EGA V9 permits valid workflows while preserving execution, policy, and verification evidence for later review.

---

### Step 4). Deployment Decision

Should EGA V9 be deployed to your production AI workflow?

```text
YES / NO
```

---

### Step 5). Business Impact

After completing the evaluation, consider the operational benefits.

**Operational Reliability**

- Enforces company policies before execution.
- Detects workflow mutations before they reach production.

**Security**

- Detects approval bypass attempts.
- Detects unauthorized tool execution.
- Detects policy mutations.

**Governance**

- Replayable workflows.
- Traceable execution.
- Auditable decisions.

**Engineering**

- Faster incident investigation.
- Deterministic debugging.
- Reproducible execution evidence.

**Business**

- Reduced operational risk.
- Increased confidence before production deployment.
- Easier internal security and compliance reviews.

---

### Final Question

Based on your evaluation, 

**What would have happened without EGA V9?**

------------------------------------------------------------------------

## 9. Contact and Collaboration

Whether you are evaluating EGA V9, exploring enterprise adoption, or experimenting with new AI workflows, 
feedback and collaboration are welcome.

### Community Support
- GitHub Issues:
  https://github.com/paibyun9/EGA-V9/issues

  Use GitHub Issues for questions, bug reports, feature requests, documentation feedback, and independent reproducibility reports.

### Project Resources
- Live Vercel Demo: https://ega-v9.vercel.app/
- LCM Official Website: https://lcm3.com/

### Direct Contact
- contact@lcm3.com

------------------------------------------------------------------------

## 10. License

Released under the MIT License.

------------------------------------------------------------------------

## 11. Roadmap

- Improve SDK integrations
- Expand language support
- Add enterprise deployment examples
- Continue benchmark reproducibility
- Future EGA releases

------------------------------------------------------------------------

## Release Integrity Principle

> Do not trust a published result merely because it appears in a paper.
> Reproduce the benchmark, regenerate the publication artifact, and
> verify the release gates.
