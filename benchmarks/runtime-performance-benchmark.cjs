const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const RESULTS_DIR = path.join(__dirname, "results");
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const ITERATIONS = 10000;
const WARMUP_ITERATIONS = 1000;
const BATCH_SIZE = 100;
const MIN_TIMING_FLOOR_MS = 0.001;

function stableStringify(input) {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return "[" + input.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(input).sort().map((key) => {
    return JSON.stringify(key) + ":" + stableStringify(input[key]);
  }).join(",") + "}";
}

function simpleHash(input) {
  const text = stableStringify(input);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const workflow = {
  workflowId: "purchase-demo-001",
  steps: [
    { step: 1, action: "search_product", item: "laptop" },
    { step: 2, action: "select_product", quantity: 1 },
    { step: 3, action: "checkout_request", approved: true }
  ]
};

const dag = {
  workflowId: "purchase-demo-001",
  dag: [
    { id: "A", action: "search_product", next: "B" },
    { id: "B", action: "select_product", next: "C" },
    { id: "C", action: "checkout_request", next: null }
  ]
};

function verificationOperation() {
  return simpleHash(workflow);
}

function replayOperation() {
  return simpleHash(dag);
}

function trustEscalationOperation() {
  const amount = 1200;
  if (amount >= 1000) return "T2_REVIEW";
  return "T1_VERIFIED";
}

function containmentOperation() {
  const mismatch = true;
  return mismatch
    ? { trustState: "CONTAINED", executionStatus: "BLOCKED" }
    : { trustState: "VERIFIED", executionStatus: "ALLOWED" };
}

function forceGcIfAvailable() {
  if (typeof global.gc === "function") {
    global.gc();
    return true;
  }
  return false;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function runWarmup(fn) {
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn();
  }
}

function measureBatched(fn) {
  runWarmup(fn);

  const gcAvailable = forceGcIfAvailable();

  const beforeMemory = process.memoryUsage().heapUsed;
  const batchLatencies = [];

  for (let i = 0; i < ITERATIONS / BATCH_SIZE; i++) {
    const start = performance.now();

    for (let j = 0; j < BATCH_SIZE; j++) {
      fn();
    }

    const end = performance.now();
    const perOperationMs = (end - start) / BATCH_SIZE;

    batchLatencies.push(Math.max(perOperationMs, MIN_TIMING_FLOOR_MS));
  }

  forceGcIfAvailable();

  const afterMemory = process.memoryUsage().heapUsed;
  const rawMemoryDeltaMb = (afterMemory - beforeMemory) / 1024 / 1024;

  return {
    iterations: ITERATIONS,
    warmup_iterations: WARMUP_ITERATIONS,
    batch_size: BATCH_SIZE,
    gc_available: gcAvailable,
    timing_floor_ms: MIN_TIMING_FLOOR_MS,
    p50_ms: percentile(batchLatencies, 50),
    p90_ms: percentile(batchLatencies, 90),
    p99_ms: percentile(batchLatencies, 99),
    mean_ms: mean(batchLatencies),
    raw_memory_delta_mb: rawMemoryDeltaMb,
    memory_overhead_mb: Math.max(0, rawMemoryDeltaMb),
    memory_policy: "negative deltas clamped to 0 because they may reflect GC/OS measurement noise"
  };
}

const benchmarks = [
  ["Verification Latency", verificationOperation],
  ["Replay Latency", replayOperation],
  ["Trust-Escalation Latency", trustEscalationOperation],
  ["Containment Activation Latency", containmentOperation]
];

const results = benchmarks.map(([metric, fn]) => ({
  metric,
  ...measureBatched(fn)
}));

const runtimeJsonPath = path.join(RESULTS_DIR, "runtime-performance-results.json");
fs.writeFileSync(runtimeJsonPath, JSON.stringify(results, null, 2));

const runtimeMd = [
  "| Metric | Iterations | Warmup | Batch Size | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) | Memory Overhead (MB) |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...results.map(r =>
    `| ${r.metric} | ${r.iterations} | ${r.warmup_iterations} | ${r.batch_size} | ${r.p50_ms} | ${r.p90_ms} | ${r.p99_ms} | ${r.mean_ms} | ${r.memory_overhead_mb} |`
  )
].join("\n");

fs.writeFileSync(path.join(RESULTS_DIR, "runtime-performance-table.md"), runtimeMd);

const runtimeCsv = [
  "metric,iterations,warmup_iterations,batch_size,p50_ms,p90_ms,p99_ms,mean_ms,memory_overhead_mb,raw_memory_delta_mb,gc_available,timing_floor_ms",
  ...results.map(r =>
    [
      r.metric,
      r.iterations,
      r.warmup_iterations,
      r.batch_size,
      r.p50_ms,
      r.p90_ms,
      r.p99_ms,
      r.mean_ms,
      r.memory_overhead_mb,
      r.raw_memory_delta_mb,
      r.gc_available,
      r.timing_floor_ms
    ].join(",")
  )
].join("\n");

fs.writeFileSync(path.join(RESULTS_DIR, "runtime-performance-table.csv"), runtimeCsv);

const costResults = [
  { metric: "Additional Language-Model Invocations", measurement: 0 },
  { metric: "Additional External API Requests", measurement: 0 },
  { metric: "CPU Utilization During Runtime Verification (%)", measurement: null },
  {
    metric: "Verification Latency P50 (ms)",
    measurement: results[0].p50_ms
  },
  {
    metric: "Verification Latency P90 (ms)",
    measurement: results[0].p90_ms
  },
  {
    metric: "Verification Latency P99 (ms)",
    measurement: results[0].p99_ms
  }
];

fs.writeFileSync(
  path.join(RESULTS_DIR, "runtime-verification-cost-results.json"),
  JSON.stringify(costResults, null, 2)
);

const costMd = [
  "| Metric | Measurement |",
  "|---|---:|",
  ...costResults.map(r => `| ${r.metric} | ${r.measurement} |`)
].join("\n");

fs.writeFileSync(path.join(RESULTS_DIR, "runtime-verification-cost-table.md"), costMd);

const costCsv = [
  "metric,measurement",
  ...costResults.map(r => `${r.metric},${r.measurement}`)
].join("\n");

fs.writeFileSync(path.join(RESULTS_DIR, "runtime-verification-cost-table.csv"), costCsv);

console.log(JSON.stringify(results, null, 2));
console.log(`Saved: ${runtimeJsonPath}`);
