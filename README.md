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

### 2). Activate your Evaluation License

After the installation completes, run:
```bash
npx ega-v9 register
```

This activates your free 90-day Evaluation License.
```bash
You will be prompted for:

Contact Name
Company Name
Work Email

After successful activation, you will see:

✓ Evaluation License Activated
✓ EGA V9 is now activated.
```

---

### 3). Create a Quick Start Example

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

### 4). Run

```bash
node quick-start.cjs
```

### 5). Expected Output

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
| npm install | ✅ Fresh Install Verified |
| npm audit | ✅ 0 Vulnerabilities |

*This step is required only once per machine.*

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

Validation artifacts are generated automatically under `publication/evidence/`.

Artifacts include:

- JSON report
- Markdown report
- Final PASS / FAIL status

---

### Validation Results

| Validation | Expected Result |
|---|---|
| Replay Root Verification | ✅ PASS |
| Workflow Divergence Detection | ✅ PASS |
| Trust-State Escalation | ✅ PASS |
| Fail-Closed Containment | ✅ PASS |
| Tool Order Integrity | ✅ PASS |
| Approval Bypass Defense | ✅ PASS |
| Workflow-Level Tool Injection Detection | ✅ PASS |

These tests validate the core deterministic-governance capabilities evaluated by EGA V9.

---

### Capability Boundaries

Additional adversarial testing was performed beyond the core validation suite.

**Verified**
- ✅ Fail-closed containment during an active mismatch

**Not Established**
- ⚠️ Persistent containment after the triggering condition is removed
- ⚠️ Exactly-once side-effect execution under concurrent, retry, or duplicate execution
- ⚠️ Complete evidence-contract integrity

**Not Verified**
- ⚠️ Multi-step compositional governance
- ⚠️ Direct interception of already-attempted external side effects

These results define the current verified capability boundary of EGA V9.

> **Don't trust our claims. Verify them yourself — including the capabilities we have not yet established.**

**We don't hide problems. We publish them, prioritize them, and work to resolve them.**

------------------------------------------------------------------------

## 8. Enterprise Evaluation


The next step is to evaluate how EGA V9 fits into a real enterprise AI workflow.


### Step 1). Define Company Policy


Before evaluating EGA V9, define the policies that your AI system must follow.


**Example: AI Shopping Policy**


| Workflow | Company Policy |
|---|---|
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

> Illustrative example only. Actual policy integration depends on your application architecture.

---

### Step 2). Integrate EGA V9

Install EGA V9:

```bash
npm install ega-v9
```

Integrate EGA V9 at the governed execution boundary of your AI workflow:

```text
Customer
  → AI Shopping Agent
  → Company Policy
  → [ EGA V9 ]
  → Inventory API | Payment API | Refund API | Shipping API
```

EGA V9 evaluates configured governance conditions before governed tool execution and records deterministic governance evidence.

---

### Step 3). Execute Governed Workflows

**Standard Order Pipeline**

```text
Customer Order
  → Agent
  → [ EGA V9 ]
  → Payment API
  → PASS
```

**Policy-Enforced Refund Pipeline**

```text
Refund Request
  → Agent
  → Manager Approval
  → [ EGA V9 ]
  → Refund API
  → PASS
```

Within the configured governance conditions, EGA V9 permits valid governed execution while preserving execution and verification evidence for later review.

#### Current Capability Boundary

Fail-closed containment is enforced while a policy or integrity violation is actively detected within the governed execution path.

Persistent, cross-request containment of a previously flagged execution identity or capability across subsequent clean-looking attempts is **not established in EGA V9**.

See **Capability Boundaries** above for additional verified and unverified capabilities.

---

### Step 4). Make the Deployment Decision

After evaluating EGA V9 in your own workflow and environment, decide whether it should be deployed to your production AI workflow.

```text
YES / NO
```

The deployment decision should be based on your own policies, workflow architecture, security requirements, and evaluation results.

---

### Step 5). Evaluate Potential Business Impact

Depending on the deployment environment, potential benefits may include:

**Operational Reliability**

- Evaluates configured governance conditions before governed tool execution.
- Detects evaluated workflow mutations before governed tool execution.
- Produces deterministic governance evidence for later investigation.

**Security**

- Detects evaluated approval-bypass attempts.
- Detects evaluated unauthorized tool execution.
- Detects evaluated policy and workflow mutations.

**Governance**

- Replayable governed workflows.
- Traceable execution evidence.
- Auditable governance decisions.

**Engineering**

- Deterministic workflow debugging.
- Reproducible execution evidence.
- Additional evidence for incident investigation.

**Business**

- Additional runtime controls for operational risk management.
- Greater visibility before production deployment.
- Evidence that may support internal security and compliance reviews.

These are potential operational benefits, not guaranteed business outcomes. Actual impact depends on the application architecture, deployment environment, configured policies, and workload.

---

### Final Question

After completing your evaluation, ask:

**What would have happened without EGA V9?**

### Illustrative Scene: What Changes with EGA V9

This example is illustrative only.

Your actual company policies and runtime architecture will differ. What matters here is the governed execution boundary and the evidence produced by the governance decision.

**Without EGA V9**

```text
Refund Request
  → AI Agent
  → Refund API
```

In this illustrative configuration, the refund could reach the Refund API if the required approval or policy check were missing or bypassed.

**With EGA V9**

```text
Refund Request
  → AI Agent
  → [ EGA V9 Runtime Governance ]
       ├─ Valid workflow   → Refund API (PASS + evidence)
       └─ Invalid workflow → Containment (BLOCK + evidence)
```

EGA V9 sits at the governed execution boundary before the tool call.

If a configured policy or integrity violation is detected on the current governed request, EGA V9 applies fail-closed containment and prevents that governed execution path from reaching the Refund API.

**Example Containment Evidence (Simplified)**

```json
{
  "decision": "BLOCK",
  "reason": "policy_violation",
  "containment": true,
  "executionAllowed": false
}
```

---

### In Short

EGA V9 does not replace your AI agent, foundation model, application logic, or company policies.

It provides a deterministic runtime-governance layer that evaluates configured governance conditions at the governed execution boundary and records deterministic evidence when execution is verified or blocked.

**Evaluate it in your own environment. Verify the evidence. Then decide whether to deploy it.**

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
