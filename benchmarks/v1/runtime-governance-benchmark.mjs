import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { performance } from "node:perf_hooks";

import { ega } from "../../packages/sdk-ts/dist/index.js";

const NORMAL_WORKFLOW = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    item: "laptop",
    quantity: 1
  },
  {
    step: 3,
    action: "checkout_request",
    item: "laptop",
    quantity: 1,
    approved: true
  }
];

const INVALID_EXPECTED_REPLAY_ROOT =
  "benchmark-invalid-replay-root";

const PROFILE_CONFIG = {
  smoke: {
    warmupIterations: 50,
    operationCounts: [100, 1000],
    concurrencyLevels: [1, 10]
  },

  publication: {
    warmupIterations: 1000,
    operationCounts: [1000, 10000],
    concurrencyLevels: [1, 10, 50]
  }
};

function readArgument(name, fallback) {
  const prefix = `--${name}=`;

  const argument = process.argv.find(
    (value) => value.startsWith(prefix)
  );

  return argument
    ? argument.slice(prefix.length)
    : fallback;
}

const profileName = readArgument(
  "profile",
  "smoke"
);

const outputBase = readArgument(
  "output",
  profileName === "publication"
    ? "benchmarks/results/v1-runtime-governance"
    : "/tmp/ega-v9-v1-benchmark-smoke"
);

const profile = PROFILE_CONFIG[profileName];

if (!profile) {
  throw new Error(
    `Unknown benchmark profile: ${profileName}`
  );
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function percentile(sortedValues, percentage) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position =
    (sortedValues.length - 1) * percentage;

  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = position - lower;

  return (
    sortedValues[lower] * (1 - weight) +
    sortedValues[upper] * weight
  );
}

function summarizeLatencies(values) {
  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const total = sorted.reduce(
    (sum, value) => sum + value,
    0
  );

  return {
    meanMicroseconds: round(
      total / sorted.length
    ),

    p50Microseconds: round(
      percentile(sorted, 0.50)
    ),

    p95Microseconds: round(
      percentile(sorted, 0.95)
    ),

    p99Microseconds: round(
      percentile(sorted, 0.99)
    ),

    minMicroseconds: round(sorted[0]),

    maxMicroseconds: round(
      sorted[sorted.length - 1]
    )
  };
}

function createResponse(onJson) {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,

    setHeader(name, value) {
      this.headers[
        String(name).toLowerCase()
      ] = String(value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      onJson(body);
    }
  };
}

function createRequest(scenario) {
  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",

    body: {
      workflow: structuredClone(
        NORMAL_WORKFLOW
      )
    },

    query: {},
    params: {},

    headers: {
      host: "localhost"
    }
  };

  if (scenario === "replay-mismatch") {
    request.headers[
      "x-ega-expected-replay-root"
    ] = INVALID_EXPECTED_REPLAY_ROOT;
  }

  return request;
}

async function runGovernanceOperation(
  middleware,
  scenario
) {
  const request = createRequest(scenario);

  let completionType;
  let nextCalls = 0;

  let resolveCompletion;
  let rejectCompletion;

  const completion = new Promise(
    (resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    }
  );

  const response = createResponse(() => {
    completionType = "response";
    resolveCompletion();
  });

  const timeout = setTimeout(() => {
    rejectCompletion(
      new Error(
        `Benchmark operation timed out: ${scenario}`
      )
    );
  }, 5000);

  const startedAt = process.hrtime.bigint();

  try {
    await middleware(
      request,
      response,
      (error) => {
        nextCalls += 1;

        if (error) {
          rejectCompletion(error);
          return;
        }

        completionType = "next";
        resolveCompletion();
      }
    );

    await completion;
  } finally {
    clearTimeout(timeout);
  }

  const finishedAt = process.hrtime.bigint();

  const endToEndMicroseconds =
    Number(finishedAt - startedAt) / 1000;

  const decision = request.egaDecision;

  if (!decision || !request.ega) {
    throw new Error(
      "Benchmark operation produced no governance evidence."
    );
  }

  if (scenario === "normal") {
    if (
      completionType !== "next" ||
      nextCalls !== 1 ||
      decision.verified !== true ||
      decision.containmentRequired !== false ||
      decision.executionAllowed !== true
    ) {
      throw new Error(
        "Normal benchmark operation violated its correctness contract."
      );
    }
  }

  if (scenario === "replay-mismatch") {
    if (
      completionType !== "response" ||
      nextCalls !== 0 ||
      response.statusCode !== 403 ||
      decision.verified !== false ||
      decision.containmentRequired !== true ||
      decision.executionAllowed !== false ||
      request.ega.detection.status !==
        "mismatch"
    ) {
      throw new Error(
        "Replay-mismatch benchmark operation violated its correctness contract."
      );
    }
  }

  return {
    endToEndMicroseconds,

    internalGuardMicroseconds:
      decision.latencyMicroseconds,

    replayRoot: request.ega.replayRoot,

    evidenceBytes: Buffer.byteLength(
      JSON.stringify(request.ega),
      "utf8"
    ),

    executionAllowed:
      decision.executionAllowed,

    containmentRequired:
      decision.containmentRequired
  };
}

async function warmUp(
  middleware,
  scenario,
  iterations
) {
  for (
    let iteration = 0;
    iteration < iterations;
    iteration += 1
  ) {
    await runGovernanceOperation(
      middleware,
      scenario
    );
  }
}

async function measureScenario({
  scenario,
  operationCount,
  concurrency,
  warmupIterations
}) {
  const middleware = ega.guard({
    mode: "fail-closed",
    statusCode: 403
  });

  await warmUp(
    middleware,
    scenario,
    warmupIterations
  );

  if (typeof global.gc === "function") {
    global.gc();
  }

  const memoryBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();

  const wallStartedAt = performance.now();

  const endToEndLatencies = [];
  const internalGuardLatencies = [];

  let totalEvidenceBytes = 0;
  let completedOperations = 0;
  let errors = 0;
  let replayRootDivergences = 0;
  let canonicalReplayRoot;
  let peakHeapUsedBytes =
    memoryBefore.heapUsed;

  let cursor = 0;

  async function worker() {
    while (true) {
      const operationIndex = cursor;
      cursor += 1;

      if (operationIndex >= operationCount) {
        return;
      }

      try {
        const result =
          await runGovernanceOperation(
            middleware,
            scenario
          );

        endToEndLatencies.push(
          result.endToEndMicroseconds
        );

        internalGuardLatencies.push(
          result.internalGuardMicroseconds
        );

        totalEvidenceBytes +=
          result.evidenceBytes;

        if (
          canonicalReplayRoot === undefined
        ) {
          canonicalReplayRoot =
            result.replayRoot;
        } else if (
          canonicalReplayRoot !==
          result.replayRoot
        ) {
          replayRootDivergences += 1;
        }

        completedOperations += 1;

        if (
          completedOperations % 50 === 0
        ) {
          peakHeapUsedBytes = Math.max(
            peakHeapUsedBytes,
            process.memoryUsage().heapUsed
          );
        }
      } catch (error) {
        errors += 1;

        console.error(
          `Benchmark operation failed: ${scenario}`,
          error
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          concurrency,
          operationCount
        )
      },
      () => worker()
    )
  );

  const wallFinishedAt = performance.now();

  const cpuUsed = process.cpuUsage(
    cpuBefore
  );

  const memoryAfter = process.memoryUsage();

  peakHeapUsedBytes = Math.max(
    peakHeapUsedBytes,
    memoryAfter.heapUsed
  );

  const wallClockMilliseconds =
    wallFinishedAt - wallStartedAt;

  const operationsPerSecond =
    completedOperations /
    (wallClockMilliseconds / 1000);

  const totalCpuMicroseconds =
    cpuUsed.user + cpuUsed.system;

  return {
    scenario,
    operationCount,
    concurrency,
    warmupIterations,

    completedOperations,
    errors,
    replayRootDivergences,

    latency:
      summarizeLatencies(
        endToEndLatencies
      ),

    internalGuardLatency:
      summarizeLatencies(
        internalGuardLatencies
      ),

    throughput: {
      operationsPerSecond: round(
        operationsPerSecond
      ),

      wallClockMilliseconds: round(
        wallClockMilliseconds
      )
    },

    replayCost: {
      cpuMicrosecondsPerOperation:
        round(
          totalCpuMicroseconds /
            completedOperations
        ),

      internalGuardMicrosecondsPerOperation:
        round(
          internalGuardLatencies.reduce(
            (sum, value) => sum + value,
            0
          ) /
            completedOperations
        ),

      evidenceBytesPerOperation:
        round(
          totalEvidenceBytes /
            completedOperations
        ),

      llmCalls: 0,

      networkCallsInitiatedByHarness: 0
    },

    memory: {
      heapUsedBeforeBytes:
        memoryBefore.heapUsed,

      heapUsedAfterBytes:
        memoryAfter.heapUsed,

      heapUsedDeltaBytes:
        memoryAfter.heapUsed -
        memoryBefore.heapUsed,

      peakHeapUsedBytes,

      rssBeforeBytes:
        memoryBefore.rss,

      rssAfterBytes:
        memoryAfter.rss,

      rssDeltaBytes:
        memoryAfter.rss -
        memoryBefore.rss
    }
  };
}

function csvEscape(value) {
  const text = String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function createCsv(results) {
  const headers = [
    "scenario",
    "operation_count",
    "concurrency",
    "completed_operations",
    "errors",
    "replay_root_divergences",
    "mean_latency_us",
    "p50_latency_us",
    "p95_latency_us",
    "p99_latency_us",
    "operations_per_second",
    "cpu_us_per_operation",
    "internal_guard_us_per_operation",
    "evidence_bytes_per_operation",
    "heap_delta_bytes",
    "peak_heap_used_bytes",
    "rss_delta_bytes",
    "llm_calls"
  ];

  const rows = results.map((result) => [
    result.scenario,
    result.operationCount,
    result.concurrency,
    result.completedOperations,
    result.errors,
    result.replayRootDivergences,
    result.latency.meanMicroseconds,
    result.latency.p50Microseconds,
    result.latency.p95Microseconds,
    result.latency.p99Microseconds,
    result.throughput.operationsPerSecond,
    result.replayCost
      .cpuMicrosecondsPerOperation,
    result.replayCost
      .internalGuardMicrosecondsPerOperation,
    result.replayCost
      .evidenceBytesPerOperation,
    result.memory.heapUsedDeltaBytes,
    result.memory.peakHeapUsedBytes,
    result.memory.rssDeltaBytes,
    result.replayCost.llmCalls
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map(csvEscape).join(",")
    )
  ].join("\n") + "\n";
}

function createMarkdown(report) {
  const lines = [
    "# EGA V9 v1 Runtime Governance Benchmark",
    "",
    `- Profile: \`${report.profile}\``,
    `- Generated: \`${report.generatedAt}\``,
    `- Node.js: \`${report.environment.nodeVersion}\``,
    `- Platform: \`${report.environment.platform}\``,
    `- CPU: \`${report.environment.cpuModel}\``,
    "",
    "| Scenario | Operations | Concurrency | Mean µs | p50 µs | p95 µs | p99 µs | Ops/sec | CPU µs/op | Evidence bytes/op | Errors | Root divergence |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.scenario} | ` +
      `${result.operationCount} | ` +
      `${result.concurrency} | ` +
      `${result.latency.meanMicroseconds} | ` +
      `${result.latency.p50Microseconds} | ` +
      `${result.latency.p95Microseconds} | ` +
      `${result.latency.p99Microseconds} | ` +
      `${result.throughput.operationsPerSecond} | ` +
      `${result.replayCost.cpuMicrosecondsPerOperation} | ` +
      `${result.replayCost.evidenceBytesPerOperation} | ` +
      `${result.errors} | ` +
      `${result.replayRootDivergences} |`
    );
  }

  lines.push(
    "",
    "## Interpretation Boundaries",
    "",
    "- These values measure the local EGA runtime-governance path.",
    "- They do not include foundation-model inference.",
    "- The benchmark harness initiates zero LLM calls.",
    "- Smoke-profile results are diagnostic and must not be cited.",
    "- Publication-profile results remain candidate evidence until repeated-run review and benchmark-gate approval.",
    ""
  );

  return lines.join("\n");
}

const results = [];

for (
  const operationCount of
    profile.operationCounts
) {
  for (
    const concurrency of
      profile.concurrencyLevels
  ) {
    for (const scenario of [
      "normal",
      "replay-mismatch"
    ]) {
      console.log(
        `Running ${scenario}: ` +
        `${operationCount} operations, ` +
        `concurrency=${concurrency}`
      );

      const result =
        await measureScenario({
          scenario,
          operationCount,
          concurrency,
          warmupIterations:
            profile.warmupIterations
        });

      results.push(result);

      console.log({
        scenario: result.scenario,
        operationCount:
          result.operationCount,
        concurrency:
          result.concurrency,
        p50Microseconds:
          result.latency.p50Microseconds,
        p99Microseconds:
          result.latency.p99Microseconds,
        operationsPerSecond:
          result.throughput
            .operationsPerSecond,
        errors: result.errors,
        replayRootDivergences:
          result.replayRootDivergences
      });
    }
  }
}

const report = {
  schemaVersion: "1.0.0",
  benchmark:
    "EGA V9 v1 Runtime Governance Benchmark",
  profile: profileName,
  generatedAt: new Date().toISOString(),

  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    operatingSystemRelease: os.release(),
    cpuModel:
      os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalSystemMemoryBytes:
      os.totalmem()
  },

  benchmarkConfiguration: {
    warmupIterations:
      profile.warmupIterations,
    operationCounts:
      profile.operationCounts,
    concurrencyLevels:
      profile.concurrencyLevels,
    scenarios: [
      "normal",
      "replay-mismatch"
    ]
  },

  integrity: {
    totalErrors: results.reduce(
      (sum, result) =>
        sum + result.errors,
      0
    ),

    totalReplayRootDivergences:
      results.reduce(
        (sum, result) =>
          sum +
          result.replayRootDivergences,
      0
    ),

    llmCalls: 0
  },

  results
};

const resolvedOutputBase =
  path.resolve(outputBase);

fs.mkdirSync(
  path.dirname(resolvedOutputBase),
  {
    recursive: true
  }
);

fs.writeFileSync(
  `${resolvedOutputBase}.json`,
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);

fs.writeFileSync(
  `${resolvedOutputBase}.csv`,
  createCsv(results),
  "utf8"
);

fs.writeFileSync(
  `${resolvedOutputBase}.md`,
  createMarkdown(report),
  "utf8"
);

console.log(
  "\nEGA V9 v1 Benchmark Result"
);

console.log({
  profile: profileName,
  resultGroups: results.length,
  totalErrors:
    report.integrity.totalErrors,
  totalReplayRootDivergences:
    report.integrity
      .totalReplayRootDivergences,
  llmCalls:
    report.integrity.llmCalls,
  outputBase: resolvedOutputBase
});

if (
  report.integrity.totalErrors !== 0 ||
  report.integrity
    .totalReplayRootDivergences !== 0
) {
  console.error(
    "❌ Benchmark integrity failure"
  );

  process.exit(1);
}

console.log(
  "✅ Benchmark completed with zero correctness errors"
);
