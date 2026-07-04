const { performance } = require("perf_hooks");
const fs = require("fs");
const path = require("path");

const ITERATIONS = 10000;
const WARMUP = 1000;

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Replace this with real EGA verification call later.
function verifyWorkflow() {
  const input = {
    workflow_id: "wf-benchmark",
    action: "tool_call",
    policy: "policy-v1",
    amount: 42,
  };

  const canonical = JSON.stringify(input);
  let hash = 0;

  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash + canonical.charCodeAt(i)) | 0;
  }

  return hash;
}

function measure(label, fn) {
  for (let i = 0; i < WARMUP; i++) fn();

  const times = [];

  const memoryBefore = process.memoryUsage().heapUsed;

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    metric: label,
    iterations: ITERATIONS,
    p50_ms: percentile(times, 50),
    p90_ms: percentile(times, 90),
    p99_ms: percentile(times, 99),
    mean_ms: mean(times),
    memory_overhead_mb: (memoryAfter - memoryBefore) / 1024 / 1024,
  };
}

const results = [
  measure("Verification Latency", verifyWorkflow),
  measure("Replay Latency", verifyWorkflow),
  measure("Trust-Escalation Latency", verifyWorkflow),
  measure("Containment Activation Latency", verifyWorkflow),
];

const outputPath = path.join(__dirname, "results", "runtime-performance-results.json");
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

console.log(JSON.stringify(results, null, 2));
console.log(`Saved: ${outputPath}`);
