const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();

let failed = false;
let warnings = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`✅ ${name}`);
    return;
  }

  console.log(`❌ ${name}`);
  if (detail) console.log(`   ${detail}`);
  failed = true;
}

function warn(name, detail = "") {
  console.log(`⚠️  ${name}`);
  if (detail) console.log(`   ${detail}`);
  warnings += 1;
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function containsAll(text, values) {
  return values.filter((value) => !text.includes(value));
}

function isPending(value) {
  return (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.includes("PENDING") ||
    value.includes("REPLACE_ME") ||
    value.includes("example.com")
  );
}

async function checkLiveUrl(name, url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "user-agent": "EGA-V9-Stage-E-Publication-Gate/1.0"
      }
    });

    check(
      `${name} is publicly reachable`,
      response.ok,
      `HTTP ${response.status}: ${url}`
    );
  } catch (error) {
    check(
      `${name} is publicly reachable`,
      false,
      `${url} — ${error.message}`
    );
  }
}

(async () => {
  console.log("\nEGA V9 Stage E — Publication Consistency Gate\n");

  const manifestPath = "publication/manifest.json";

  check(
    "Publication manifest exists",
    exists(manifestPath),
    `Expected: ${manifestPath}`
  );

  if (!exists(manifestPath)) {
    console.log("\n❌ BLOCKED — Publication manifest is missing.\n");
    process.exit(1);
  }

  const manifest = readJson(manifestPath);

  // ---------------------------------------------------------
  // 1. Required project artifacts
  // ---------------------------------------------------------

  const requiredFiles = [
    "package.json",
    "README.md",
    "SECURITY.md",
    "dashboard/index.html",
    "packages/sdk-ts/package.json",
    "packages/sdk-ts/src/index.ts",
    manifest.benchmark_table
  ];

  for (const file of requiredFiles) {
    check(`${file} exists`, exists(file));
  }

  if (failed) {
    console.log(
      "\n❌ BLOCKED — Required publication artifacts are missing.\n"
    );
    process.exit(1);
  }

  const rootPackage = readJson("package.json");
  const sdkPackage = readJson("packages/sdk-ts/package.json");

  const rootReadme = read("README.md");
  const sdkSource = read("packages/sdk-ts/src/index.ts");
  const demoHtml = read("dashboard/index.html");
  const securityText = read("SECURITY.md");
  const table4 = readJson(manifest.benchmark_table);

  // ---------------------------------------------------------
  // 2. Canonical identity
  // ---------------------------------------------------------

  check(
    "Root package name matches canonical npm package",
    rootPackage.name === manifest.npm_package,
    `Manifest=${manifest.npm_package}, root package=${rootPackage.name}`
  );

  check(
    "SDK package name matches canonical npm package",
    sdkPackage.name === manifest.npm_package,
    `Manifest=${manifest.npm_package}, SDK package=${sdkPackage.name}`
  );

  check(
    "Manifest license is MIT",
    manifest.license === "MIT"
  );

  check(
    "SDK license matches manifest",
    sdkPackage.license === manifest.license,
    `Manifest=${manifest.license}, SDK=${sdkPackage.license}`
  );

  check(
    "Security documentation exists and is non-empty",
    securityText.trim().length > 100
  );

  // ---------------------------------------------------------
  // 3. Version alignment
  // ---------------------------------------------------------

  if (manifest.release_policy.require_version_alignment) {
    check(
      "Root package version matches target release",
      rootPackage.version === manifest.target_version,
      `Target=${manifest.target_version}, root=${rootPackage.version}`
    );

    check(
      "SDK package version matches target release",
      sdkPackage.version === manifest.target_version,
      `Target=${manifest.target_version}, SDK=${sdkPackage.version}`
    );

    check(
      "Demo displays target version",
      demoHtml.includes(`v${manifest.target_version}`),
      `Expected demo to contain v${manifest.target_version}`
    );

    check(
      "README displays target version or package version",
      rootReadme.includes(manifest.target_version) ||
        rootReadme.includes(`v${manifest.target_version}`),
      `Expected README to contain ${manifest.target_version}`
    );
  }

  // ---------------------------------------------------------
  // 4. Public API consistency
  // ---------------------------------------------------------

  for (const api of manifest.public_api) {
    check(
      `SDK exposes or defines public API: ${api}`,
      sdkSource.includes(api),
      `${api} was not found in packages/sdk-ts/src/index.ts`
    );
  }

  check(
    "README contains canonical install command",
    rootReadme.includes(`npm install ${manifest.npm_package}`),
    `Expected: npm install ${manifest.npm_package}`
  );

  check(
    "Demo contains canonical install command",
    demoHtml.includes(`npm install ${manifest.npm_package}`),
    `Expected: npm install ${manifest.npm_package}`
  );

  check(
    "Demo uses canonical govern/import package name",
    demoHtml.includes(`from "${manifest.npm_package}"`) ||
      demoHtml.includes(`from '${manifest.npm_package}'`),
    `Expected import from ${manifest.npm_package}`
  );

  // ---------------------------------------------------------
  // 5. Demo feature consistency
  // ---------------------------------------------------------

  for (const feature of manifest.required_demo_features) {
    check(
      `Demo includes feature: ${feature}`,
      demoHtml.includes(feature)
    );
  }

  const missingDemoPhrases = containsAll(
    demoHtml,
    manifest.required_publication_phrases
  );

  check(
    "Demo contains all canonical publication phrases",
    missingDemoPhrases.length === 0,
    missingDemoPhrases.length
      ? `Missing: ${missingDemoPhrases.join(", ")}`
      : ""
  );

  // ---------------------------------------------------------
  // 6. URL consistency
  // ---------------------------------------------------------

  check(
    "GitHub URL is finalized",
    !isPending(manifest.github_repository),
    manifest.github_repository
  );

  check(
    "npm URL is finalized",
    !isPending(manifest.npm_url),
    manifest.npm_url
  );

  if (manifest.release_policy.require_demo_url) {
    check(
      "Vercel Demo URL is finalized",
      !isPending(manifest.vercel_demo_url),
      "Replace PENDING_VERCEL_URL after Vercel deployment."
    );
  }

  check(
    "Demo links canonical GitHub repository",
    demoHtml.includes(manifest.github_repository),
    `Expected: ${manifest.github_repository}`
  );

  check(
    "Demo links canonical npm page",
    demoHtml.includes(manifest.npm_url),
    `Expected: ${manifest.npm_url}`
  );

  if (!isPending(manifest.vercel_demo_url)) {
    check(
      "Manifest Vercel URL uses HTTPS",
      manifest.vercel_demo_url.startsWith("https://")
    );
  }

  // ---------------------------------------------------------
  // 7. Benchmark publication artifact
  // ---------------------------------------------------------

  check(
    "Table 4 contains four metrics",
    Array.isArray(table4.rows) && table4.rows.length === 4
  );

  check(
    "Table 4 source points to benchmark artifact",
    table4.source ===
      "benchmarks/results/runtime-performance-results.json",
    `Current source=${table4.source}`
  );

  check(
    "Table 4 uses six-decimal publication precision",
    table4.decimal_places === 6
  );

  // ---------------------------------------------------------
  // 8. Homepage alignment — enabled only at final phase
  // ---------------------------------------------------------

  if (manifest.release_policy.require_homepage_alignment) {
    const homepageSnapshot = "publication/lcm3-homepage-snapshot.html";

    check(
      "lcm3.com publication snapshot exists",
      exists(homepageSnapshot),
      `Expected: ${homepageSnapshot}`
    );

    if (exists(homepageSnapshot)) {
      const homepage = read(homepageSnapshot);

      check(
        "Homepage contains canonical project name",
        homepage.includes(manifest.short_name) ||
          homepage.includes(manifest.project_name)
      );

      check(
        "Homepage links GitHub",
        homepage.includes(manifest.github_repository)
      );

      check(
        "Homepage links npm",
        homepage.includes(manifest.npm_url)
      );

      check(
        "Homepage links Vercel Demo",
        homepage.includes(manifest.vercel_demo_url)
      );

      check(
        "Homepage displays target version",
        homepage.includes(manifest.target_version) ||
          homepage.includes(`v${manifest.target_version}`)
      );
    }
  } else {
    warn(
      "Homepage consistency check is deferred",
      "Set require_homepage_alignment=true after lcm3.com is updated."
    );
  }

  // ---------------------------------------------------------
  // 9. Git cleanliness
  // ---------------------------------------------------------

  if (manifest.release_policy.require_clean_git) {
    let status = "";

    try {
      status = execSync("git status --porcelain", {
        encoding: "utf8"
      }).trim();
    } catch (error) {
      check("Git working tree can be inspected", false, error.message);
    }

    check(
      "Git working tree is clean",
      status.length === 0,
      status || "Commit or discard local changes."
    );
  }

  // ---------------------------------------------------------
  // 10. Optional live URL validation
  // ---------------------------------------------------------

  const liveMode =
    manifest.release_policy.require_live_url_checks ||
    process.env.EGA_LIVE_PUBLICATION_CHECK === "1";

  if (liveMode) {
    console.log("\nLive publication checks:");

    await checkLiveUrl("GitHub repository", manifest.github_repository);
    await checkLiveUrl("npm package", manifest.npm_url);

    if (!isPending(manifest.vercel_demo_url)) {
      await checkLiveUrl("Vercel Demo", manifest.vercel_demo_url);
    }

    if (manifest.release_policy.require_homepage_alignment) {
      await checkLiveUrl("lcm3.com", manifest.homepage_url);
    }
  } else {
    warn(
      "Live URL checks were not executed",
      "Run EGA_LIVE_PUBLICATION_CHECK=1 npm run stage-e:gate when public URLs are ready."
    );
  }

  // ---------------------------------------------------------
  // Final result
  // ---------------------------------------------------------

  console.log("\nStage E Result:");

  if (failed) {
    console.log(
      "❌ BLOCKED — Public artifacts are not fully consistent with the Publication Manifest.\n"
    );
    process.exit(1);
  }

  console.log(
    "✅ PASSED — Public artifacts match the Publication Manifest."
  );

  if (warnings > 0) {
    console.log(
      `⚠️  Passed with ${warnings} deferred/optional warning(s).\n`
    );
  } else {
    console.log("");
  }
})();
