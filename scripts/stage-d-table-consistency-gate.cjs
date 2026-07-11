const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const benchmarkPath = path.join(
  ROOT,
  "benchmarks/results/runtime-performance-results.json"
);

const tablePath = path.join(
  ROOT,
  "paper/generated/table4-runtime-performance.json"
);

let failed = false;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`✅ ${name}`);
    return;
  }

  console.log(`❌ ${name}`);

  if (detail) {
    console.log(`   ${detail}`);
  }

  failed = true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function round6(value) {
  return Number(value.toFixed(6));
}

console.log("\nEGA V9 Stage D — Benchmark → Table 4 Consistency Gate\n");

check(
  "Stage C benchmark result exists",
  fs.existsSync(benchmarkPath),
  "Run npm run stage-c:gate first."
);

check(
  "Generated Table 4 data exists",
  fs.existsSync(tablePath),
  "Run npm run table4:build first."
);

if (!fs.existsSync(benchmarkPath) || !fs.existsSync(tablePath)) {
  console.log(
    "\n❌ BLOCKED — Required Stage D input is missing.\n"
  );
  process.exit(1);
}

const benchmarkRows = readJson(benchmarkPath);
const table4 = readJson(tablePath);

check(
  "Benchmark source is an array",
  Array.isArray(benchmarkRows)
);

check(
  "Table 4 contains four rows",
  Array.isArray(table4.rows) && table4.rows.length === 4
);

check(
  "Table 4 declares six-decimal precision",
  table4.decimal_places === 6
);

const requiredMetrics = [
  "Verification Latency",
  "Replay Latency",
  "Trust-Escalation Latency",
  "Containment Activation Latency"
];

for (const metric of requiredMetrics) {
  const benchmark = benchmarkRows.find((row) => row.metric === metric);
  const paperRow = table4.rows.find((row) => row.metric === metric);

  check(
    `${metric}: benchmark row exists`,
    Boolean(benchmark)
  );

  check(
    `${metric}: Table 4 row exists`,
    Boolean(paperRow)
  );

  if (!benchmark || !paperRow) {
    continue;
  }

  const comparisons = [
    ["P50", round6(benchmark.p50_ms), paperRow.p50_ms],
    ["P90", round6(benchmark.p90_ms), paperRow.p90_ms],
    ["P99", round6(benchmark.p99_ms), paperRow.p99_ms],
    ["Mean", round6(benchmark.mean_ms), paperRow.mean_ms]
  ];

  for (const [label, expected, actual] of comparisons) {
    check(
      `${metric}: ${label} matches`,
      expected === actual,
      `Benchmark=${expected.toFixed(6)}, Table 4=${Number(actual).toFixed(6)}`
    );
  }
}

const firstBenchmark = benchmarkRows[0] ?? {};
const config = table4.benchmark_configuration ?? {};

check(
  "Iteration count matches",
  firstBenchmark.iterations === config.iterations,
  `Benchmark=${firstBenchmark.iterations}, Table 4=${config.iterations}`
);

check(
  "Warm-up count matches",
  firstBenchmark.warmup_iterations === config.warmup_iterations,
  `Benchmark=${firstBenchmark.warmup_iterations}, Table 4=${config.warmup_iterations}`
);

check(
  "Batch size matches",
  firstBenchmark.batch_size === config.batch_size,
  `Benchmark=${firstBenchmark.batch_size}, Table 4=${config.batch_size}`
);

check(
  "Timing floor matches",
  firstBenchmark.timing_floor_ms === config.timing_floor_ms,
  `Benchmark=${firstBenchmark.timing_floor_ms}, Table 4=${config.timing_floor_ms}`
);

console.log("\nStage D Result:");

if (failed) {
  console.log(
    "❌ BLOCKED — Table 4 does not match the current Stage C benchmark artifact.\n"
  );
  console.log(
    "Fix: review the benchmark result, then run npm run table4:build intentionally."
  );
  process.exit(1);
}

console.log(
  "✅ PASSED — Table 4 matches the Stage C benchmark artifact.\n"
);
