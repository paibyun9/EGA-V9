"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(
  __dirname,
  ".."
);

const resultFile = path.join(
  root,
  "benchmarks/results/v1-runtime-governance.json"
);

function pass(message) {
  console.log(`✅ ${message}`);
}

function fail(message) {
  console.error(`❌ ${message}`);
  failures += 1;
}

function finitePositive(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

let failures = 0;

console.log(
  "\nEGA V9 v1 Benchmark Integrity Gate\n"
);

if (!fs.existsSync(resultFile)) {
  fail("Publication benchmark result exists");
  process.exit(1);
}

pass("Publication benchmark result exists");

let report;

try {
  report = JSON.parse(
    fs.readFileSync(resultFile, "utf8")
  );

  pass("Benchmark result JSON is valid");
} catch (error) {
  fail(
    `Benchmark result JSON is invalid: ${error.message}`
  );

  process.exit(1);
}

if (report.profile === "publication") {
  pass("Benchmark uses publication profile");
} else {
  fail(
    `Expected publication profile, received ${report.profile}`
  );
}

if (
  report.integrity?.totalErrors === 0
) {
  pass("Benchmark has zero correctness errors");
} else {
  fail(
    `Correctness errors: ${report.integrity?.totalErrors}`
  );
}

if (
  report.integrity
    ?.totalReplayRootDivergences === 0
) {
  pass(
    "Benchmark has zero replay-root divergences"
  );
} else {
  fail(
    "Replay-root divergence was detected"
  );
}

if (report.integrity?.llmCalls === 0) {
  pass("Benchmark harness uses zero LLM calls");
} else {
  fail(
    `Unexpected LLM calls: ${report.integrity?.llmCalls}`
  );
}

const results = Array.isArray(
  report.results
)
  ? report.results
  : [];

if (results.length === 12) {
  pass(
    "Publication benchmark contains 12 result groups"
  );
} else {
  fail(
    `Expected 12 result groups, received ${results.length}`
  );
}

const operationCounts = new Set(
  results.map(
    (result) => result.operationCount
  )
);

if (
  operationCounts.has(1000) &&
  operationCounts.has(10000)
) {
  pass(
    "Scalability includes 1,000 and 10,000 operations"
  );
} else {
  fail(
    "Required scalability operation counts are missing"
  );
}

const concurrencyLevels = new Set(
  results.map(
    (result) => result.concurrency
  )
);

if (
  concurrencyLevels.has(1) &&
  concurrencyLevels.has(10) &&
  concurrencyLevels.has(50)
) {
  pass(
    "Scalability includes concurrency 1, 10, and 50"
  );
} else {
  fail(
    "Required concurrency levels are missing"
  );
}

for (const result of results) {
  const label =
    `${result.scenario}/` +
    `${result.operationCount}/` +
    `c${result.concurrency}`;

  if (
    result.completedOperations ===
      result.operationCount &&
    result.errors === 0
  ) {
    pass(`${label}: all operations completed`);
  } else {
    fail(
      `${label}: incomplete or failed operations`
    );
  }

  if (
    result.replayRootDivergences === 0
  ) {
    pass(
      `${label}: deterministic replay root`
    );
  } else {
    fail(
      `${label}: replay-root divergence`
    );
  }

  if (
    finitePositive(
      result.latency?.p50Microseconds
    ) &&
    finitePositive(
      result.latency?.p95Microseconds
    ) &&
    finitePositive(
      result.latency?.p99Microseconds
    )
  ) {
    pass(`${label}: latency metrics valid`);
  } else {
    fail(`${label}: invalid latency metrics`);
  }

  if (
    finitePositive(
      result.throughput
        ?.operationsPerSecond
    )
  ) {
    pass(`${label}: throughput valid`);
  } else {
    fail(`${label}: throughput invalid`);
  }

  if (
    finitePositive(
      result.replayCost
        ?.cpuMicrosecondsPerOperation
    ) &&
    finitePositive(
      result.replayCost
        ?.evidenceBytesPerOperation
    ) &&
    result.replayCost?.llmCalls === 0
  ) {
    pass(`${label}: replay cost valid`);
  } else {
    fail(`${label}: replay cost invalid`);
  }

  const memory = result.memory ?? {};

  if (
    Number.isFinite(
      memory.heapUsedDeltaBytes
    ) &&
    finitePositive(
      memory.peakHeapUsedBytes
    ) &&
    Number.isFinite(
      memory.rssDeltaBytes
    )
  ) {
    pass(`${label}: memory metrics valid`);
  } else {
    fail(`${label}: memory metrics invalid`);
  }
}

console.log(
  "\nBenchmark Gate Result:"
);

if (failures > 0) {
  console.error(
    `❌ BLOCKED — ${failures} benchmark integrity check(s) failed.`
  );

  process.exit(1);
}

console.log(
  "✅ PASS — Publication benchmark is internally consistent."
);
