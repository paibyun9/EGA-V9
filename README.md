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

The next step is simple: evaluate EGA V9 inside a real enterprise AI workflow.

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
```

> Illustrative example only. Actual policy integration depends on your application architecture.

---

### Step 2). Integrate EGA V9

Install EGA V9:

```bash
npm install ega-v9
```

Place EGA V9 at the governed execution boundary:

```text
Customer
  → AI Shopping Agent
  → Company Policy
  → [ EGA V9 ]
  → Inventory API | Payment API | Refund API | Shipping API
```

EGA V9 evaluates configured governance conditions before governed tool execution and records deterministic governance evidence.

It does not replace the AI agent or the company policy. It governs the execution path between the agent decision and the protected tool or API.

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

A valid governed workflow proceeds to execution.

When EGA V9 detects a policy or integrity violation on the governed execution path, it fails closed before the protected tool call and records governance evidence.

#### Current Capability Boundary

This protection has a defined boundary.

Fail-closed containment remains effective while the triggering policy or integrity violation is actively detected.

EGA V9 does **not** currently establish persistent containment across renewed execution attempts after the original triggering condition has been removed.

Exactly-once side-effect execution under concurrent, retry, or duplicate execution is also **not established** in EGA V9.

See **Capability Boundaries** above for the complete current validation status.

---

### Step 4). Make the Deployment Decision

Now test EGA V9 against your own workflows, policies, and failure scenarios.

Then make the decision:

```text
YES / NO
```

Should EGA V9 be deployed at the execution boundary of your production AI workflow?

The answer should come from your own evaluation and evidence.

---

### Step 5). Evaluate the Operational Impact

After running the evaluation, examine what changes when execution governance is present.

**Operational Reliability**

- Enforces configured governance conditions before protected tool execution.
- Detects workflow mutations before protected execution.
- Records deterministic evidence when governance decisions are made.

**Security**

- Detects approval-bypass attempts.
- Detects unauthorized tool execution.
- Detects policy and workflow mutations.
- Applies fail-closed containment when a governed violation is detected.

**Governance**

- Replayable governed workflows.
- Traceable execution.
- Auditable governance decisions.
- Reproducible execution evidence.

**Engineering**

- Deterministic workflow debugging.
- Reproducible evidence for incident investigation.
- Clear PASS / BLOCK execution outcomes.

**Business**

- Adds a governance checkpoint before high-impact AI actions.
- Provides evidence for internal security and governance review.
- Makes execution failures and policy violations easier to inspect.

Actual operational impact will depend on your workflow, policies, architecture, and deployment environment.

---

### Final Question

After completing the evaluation, ask one question:

## What would have happened without EGA V9?

### Illustrative Scene: A Refund Workflow

Assume the company policy requires manager approval before a refund.

**Without an Execution-Governance Check**

```text
Refund Request
  → AI Agent
  → Refund API
```

If the required approval is missing or bypassed and no equivalent execution-governance check exists at this boundary, the refund request can reach the Refund API.

**With EGA V9**

```text
Refund Request
  → AI Agent
  → [ EGA V9 Runtime Governance ]
       │
       ├─ Valid workflow
       │     → Refund API
       │     → PASS + evidence
       │
       └─ Policy / integrity violation detected
             → BLOCK
             → Containment + evidence
```

The difference is the execution boundary.

EGA V9 checks the configured governance conditions before the protected tool call.

If the workflow is valid, execution proceeds.

If a policy or integrity violation is detected, the governed execution path fails closed before reaching the protected API and the decision is recorded as deterministic governance evidence.

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

EGA V9 does not replace your AI agent.

It does not replace your foundation model.

It does not replace your company policies.

**It adds a deterministic governance boundary before protected AI execution.**

```text
AI Decision
     ↓
Company Policy
     ↓
[ EGA V9 ]
     ↓
PASS  → Execute + Evidence
BLOCK → Contain + Evidence
```

The core question is not whether you trust the AI agent.

**The core question is whether you can verify and govern what the agent is about to execute.**

Test EGA V9 in your own environment.

**Verify the evidence. Understand the capability boundaries. Then decide whether to deploy it.**

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

**Immediate Priority**

- Persistent containment across renewed execution attempts (address the gap identified in Capability Boundaries above)

**Subsequent Priorities**

- Exactly-once side-effect governance for concurrent and retry scenarios
- Stronger evidence-contract integrity
- Compositional governance across multi-step execution paths
- Deeper interception at external execution boundaries

**Ongoing**

- Improve SDK integrations
- Expand language support
- Add enterprise deployment examples
- Continue benchmark reproducibility

------------------------------------------------------------------------

## Release Integrity Principle

> Do not trust a published result merely because it appears in a paper.
> Reproduce the benchmark, regenerate the publication artifact, and
> verify the release gates.
