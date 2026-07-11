const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const sourcePath = path.join(
  ROOT,
  "benchmarks/results/runtime-performance-results.json"
);

const outputDir = path.join(ROOT, "paper/generated");
const jsonOutputPath = path.join(outputDir, "table4-runtime-performance.json");
const markdownOutputPath = path.join(
  outputDir,
  "table4-runtime-performance.md"
);

if (!fs.existsSync(sourcePath)) {
  console.error(
    "❌ Missing benchmark source: benchmarks/results/runtime-performance-results.json"
  );
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

if (!Array.isArray(results)) {
  console.error("❌ Runtime performance results must be a JSON array.");
  process.exit(1);
}

const requiredMetrics = [
  "Verification Latency",
  "Replay Latency",
  "Trust-Escalation Latency",
  "Containment Activation Latency"
];

function round6(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Invalid numeric benchmark value: ${value}`);
  }

  return Number(value.toFixed(6));
}

const tableRows = requiredMetrics.map((metric) => {
  const row = results.find((item) => item.metric === metric);

  if (!row) {
    throw new Error(`Missing benchmark metric: ${metric}`);
  }

  return {
    metric,
    p50_ms: round6(row.p50_ms),
    p90_ms: round6(row.p90_ms),
    p99_ms: round6(row.p99_ms),
    mean_ms: round6(row.mean_ms)
  };
});

const sourceConfiguration = results[0] ?? {};

const table4 = {
  title: "Table 4. Runtime Performance Results",
  decimal_places: 6,
  source: "benchmarks/results/runtime-performance-results.json",
  benchmark_configuration: {
    iterations: sourceConfiguration.iterations,
    warmup_iterations: sourceConfiguration.warmup_iterations,
    batch_size: sourceConfiguration.batch_size,
    timing_floor_ms: sourceConfiguration.timing_floor_ms
  },
  rows: tableRows
};

fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  jsonOutputPath,
  JSON.stringify(table4, null, 2) + "\n"
);

const markdown = [
  "Table 4. Runtime Performance Results",
  "",
  "| Metric | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) |",
  "|---|---:|---:|---:|---:|",
  ...tableRows.map(
    (row) =>
      `| ${row.metric} | ${row.p50_ms.toFixed(6)} | ` +
      `${row.p90_ms.toFixed(6)} | ${row.p99_ms.toFixed(6)} | ` +
      `${row.mean_ms.toFixed(6)} |`
  ),
  "",
  "Note. Values were generated automatically from the Stage C benchmark artifact. " +
    `Benchmark configuration: ${table4.benchmark_configuration.iterations} iterations, ` +
    `${table4.benchmark_configuration.warmup_iterations} warm-up iterations, ` +
    `batch size ${table4.benchmark_configuration.batch_size}, and ` +
    `timing floor ${table4.benchmark_configuration.timing_floor_ms} ms.`,
  ""
].join("\n");

fs.writeFileSync(markdownOutputPath, markdown);

console.log("✅ Table 4 generated from benchmark source");
console.log(`   JSON: ${jsonOutputPath}`);
console.log(`   Markdown: ${markdownOutputPath}`);
