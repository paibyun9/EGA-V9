# V8 to V9 Analysis

## Purpose

Analyze existing EGA V8 components and identify how each component will be promoted into EGA V9 runtime architecture.

---

## V8 Components

### 1. replay_root.js

V9 target:

- Detection Engine
- Replay Root
- Canonicalization
- Hash verification

### 2. provenance_graph.js

V9 target:

- Explainability Engine
- DAG Provenance
- Lineage reconstruction
- Decision-to-input tracing

### 3. containment_guard.js

V9 target:

- Containment Engine
- Fail-Closed
- Quarantine
- Execution blocking

### 4. bin/ega-v8.js

V9 target:

- CLI interface
- Developer onboarding
- Demo command
- Runtime inspection

### 5. Governance UI

V9 target:

- Governance Console
- Runtime Status
- Replay Divergence Viewer
- Provenance Lineage Viewer
- Runtime Containment Console
- Governance Event Stream

---

## V9 Promotion Map

| V8 Component | V9 Module |
|---|---|
| replay_root.js | Detection Engine |
| provenance_graph.js | Explainability Engine |
| containment_guard.js | Containment Engine |
| CLI demo | Developer Runtime CLI |
| Governance UI | Governance Console |
| Event Stream | Event Bus |

---

## Day 1 Decision

V9 will not start from zero.

V9 will promote validated V8 components into a deployable runtime:

V8 proved the components.

V9 productizes the components.
