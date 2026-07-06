const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let failed = false;

function check(name, condition, detail = "") {
  if (condition) console.log(`✅ ${name}`);
  else {
    console.log(`❌ ${name}`);
    if (detail) console.log(`   ${detail}`);
    failed = true;
  }
}

function exists(p) {
  return fs.existsSync(path.join(process.cwd(), p));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), p), "utf8"));
}

function metricRow(rows, metricName) {
  return rows.find(r => r.metric === metricName);
}

console.log("\nEGA V9 Stage C Benchmark Reproducibility Gate\n");

check("Runtime benchmark script exists", exists("benchmarks/runtime-performance-benchmark.cjs"));
check("Runtime performance results exist", exists("benchmarks/results/runtime-performance-results.json"));
check("Runtime verification cost results exist", exists("benchmarks/results/runtime-verification-cost-results.json"));

try {
  execSync("node benchmarks/runtime-performance-benchmark.cjs", { stdio: "inherit" });
  check("Runtime benchmark script runs", true);
} catch {
  check("Runtime benchmark script runs", false);
}

const runtime = readJson("benchmarks/results/runtime-performance-results.json");
const cost = readJson("benchmarks/results/runtime-verification-cost-results.json");

check("Runtime performance JSON is an array", Array.isArray(runtime));
check("Runtime verification cost JSON is an array", Array.isArray(cost));

const verification = metricRow(runtime, "Verification Latency");
const replay = metricRow(runtime, "Replay Latency");
const trust = metricRow(runtime, "Trust-Escalation Latency");
const containment = metricRow(runtime, "Containment Activation Latency");

check("Verification Latency row exists", Boolean(verification));
check("Replay Latency row exists", Boolean(replay));
check("Trust-Escalation Latency row exists", Boolean(trust));
check("Containment Activation Latency row exists", Boolean(containment));

for (const row of [verification, replay, trust, containment].filter(Boolean)) {
  check(`${row.metric} p50 exists`, typeof row.p50_ms === "number");
  check(`${row.metric} p90 exists`, typeof row.p90_ms === "number");
  check(`${row.metric} p99 exists`, typeof row.p99_ms === "number");
  check(`${row.metric} iterations >= 10000`, row.iterations >= 10000);
  check(`${row.metric} p99 <= 100ms`, row.p99_ms <= 100, `Observed ${row.p99_ms}ms`);
}

const llm = metricRow(cost, "Additional Language-Model Invocations");
const api = metricRow(cost, "Additional External API Requests");
const cpu = metricRow(cost, "CPU Utilization During Runtime Verification (%)");
const p50 = metricRow(cost, "Verification Latency P50 (ms)");
const p90 = metricRow(cost, "Verification Latency P90 (ms)");
const p99 = metricRow(cost, "Verification Latency P99 (ms)");

check("Additional Language-Model Invocations row exists", Boolean(llm));
check("Additional External API Requests row exists", Boolean(api));
check("CPU utilization row exists", Boolean(cpu));
check("Verification Latency P50 row exists", Boolean(p50));
check("Verification Latency P90 row exists", Boolean(p90));
check("Verification Latency P99 row exists", Boolean(p99));

check("Runtime verification uses zero additional LLM calls", llm?.measurement === 0);
check("Runtime verification uses zero additional external API requests", api?.measurement === 0);
check("Verification Latency P99 <= 100ms", typeof p99?.measurement === "number" && p99.measurement <= 100);

check("Runtime performance Markdown table exists", exists("benchmarks/results/runtime-performance-table.md"));
check("Runtime verification cost Markdown table exists", exists("benchmarks/results/runtime-verification-cost-table.md"));
check("Runtime performance CSV table exists", exists("benchmarks/results/runtime-performance-table.csv"));
check("Runtime verification cost CSV table exists", exists("benchmarks/results/runtime-verification-cost-table.csv"));

console.log("\nStage C Benchmark Reproducibility Gate Result:");
if (failed) {
  console.log("❌ BLOCKED — Benchmark reproducibility is not ready for v1.0.0.\n");
  process.exit(1);
}

console.log("✅ PASSED — Benchmark results are reproducible under current v1.0.0 gate.\n");
