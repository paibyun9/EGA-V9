const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let failed = false;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
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

console.log("\nEGA V9 v1.0.0 Release Gate\n");

// 1. Required files
check("Root package.json exists", exists("package.json"));
check("README.md exists", exists("README.md"));
check("LICENSE or SECURITY.md exists", exists("SECURITY.md") || exists("LICENSE"));
check("Publication verification document exists", exists("docs/PUBLICATION_VERIFICATION.md"));

// 2. SDK workspace
check("TypeScript SDK package exists", exists("packages/sdk-ts/package.json"));
check("TypeScript SDK source exists", exists("packages/sdk-ts/src/index.ts"));

// 3. Demo
check("Dashboard demo exists", exists("dashboard/index.html"));

// 4. Benchmarks
check("Runtime benchmark exists", exists("benchmarks/runtime-performance-benchmark.cjs"));
check("Benchmark results directory exists", exists("benchmarks/results"));

// 5. No build artifacts tracked
let tracked = "";
try {
  tracked = execSync('git ls-files', { encoding: "utf8" });
} catch {}

check(
  "No Rust target/debug artifacts tracked",
  !tracked.includes("target/debug"),
  "Remove with: git rm -r --cached crates/**/target"
);

check(
  "No node_modules tracked",
  !tracked.includes("node_modules"),
  "Remove node_modules from Git tracking."
);

check(
  "No .env tracked",
  !tracked.split("\n").some(x => x.endsWith(".env")),
  "Never commit .env files."
);

// 6. Git status clean
let status = "";
try {
  status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
} catch {}

check(
  "Git working tree clean",
  status.length === 0,
  "Commit or discard local changes before release."
);

// 7. Package version check
const rootPkg = readJson("package.json");
const sdkPkg = readJson("packages/sdk-ts/package.json");

check("Root package name is ega-v9", rootPkg.name === "ega-v9");
check("SDK package exists", Boolean(sdkPkg.name));
check(
  "Root is monorepo private",
  rootPkg.private === true,
  "Root package should remain private; publish SDK package only."
);

// 8. Public API surface check
const sdkSource = fs.readFileSync("packages/sdk-ts/src/index.ts", "utf8");

const requiredApi = [
  "replay",
  "provenance",
  "contain",
  "verifyExecution",
  "EGA"
];

for (const api of requiredApi) {
  check(
    `SDK exports or defines ${api}`,
    sdkSource.includes(api),
    `${api} is required for v1.0.0 API consistency.`
  );
}

// 9. Demo honesty check
const demo = fs.readFileSync("dashboard/index.html", "utf8");

check("Demo includes Replay Consistency", demo.includes("Replay Consistency"));
check("Demo includes DAG Divergence Detection", demo.includes("DAG Divergence Detection"));
check("Demo includes 3-Line Integration", demo.includes("3-Line Integration"));
check("Demo shows npm install ega-v9", demo.includes("npm install ega-v9"));
check("Demo links GitHub", demo.includes("github.com/paibyun9/EGA-V9"));
check("Demo links npm", demo.includes("npmjs.com/package/ega-v9"));

// 10. Build and test
try {
  execSync("npm test", { stdio: "inherit" });
  check("npm test passes", true);
} catch {
  check("npm test passes", false);
}

try {
  execSync("npm run build", { stdio: "inherit" });
  check("npm run build passes", true);
} catch {
  check("npm run build passes", false);
}

console.log("\nRelease Gate Result:");
if (failed) {
  console.log("❌ BLOCKED — EGA V9 is not ready for v1.0.0 release.\n");
  process.exit(1);
} else {
  console.log("✅ PASSED — EGA V9 satisfies current v1.0.0 release-gate checks.\n");
}
