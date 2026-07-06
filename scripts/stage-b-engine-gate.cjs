const { execSync } = require("child_process");
const path = require("path");

let failed = false;

function pass(name) {
  console.log(`✅ ${name}`);
}

function fail(name, detail = "") {
  console.log(`❌ ${name}`);
  if (detail) console.log(`   ${detail}`);
  failed = true;
}

function check(name, condition, detail = "") {
  condition ? pass(name) : fail(name, detail);
}

async function loadSdk() {
  const sdkPath = path.resolve("packages/sdk-ts/dist/index.js");
  try {
    return require(sdkPath);
  } catch {
    return await import(`file://${sdkPath}`);
  }
}

(async () => {
  console.log("\nEGA V9 Stage B Engineering Gate\n");

  try {
    execSync("npm run build", { stdio: "inherit" });
    pass("SDK builds before engineering tests");
  } catch {
    fail("SDK builds before engineering tests");
    process.exit(1);
  }

  const sdk = await loadSdk();

  check("EGA class exists", typeof sdk.EGA === "function");
  check("replay() exists", typeof sdk.replay === "function");
  check("provenance() exists", typeof sdk.provenance === "function");
  check("contain() exists", typeof sdk.contain === "function");
  check("verifyExecution() exists", typeof sdk.verifyExecution === "function");

  const workflow = {
    workflowId: "purchase-demo-001",
    steps: [
      { step: 1, action: "search_product", item: "laptop" },
      { step: 2, action: "select_product", quantity: 1 },
      { step: 3, action: "checkout_request", approved: true }
    ]
  };

  const r1 = sdk.replay(workflow);
  const r2 = sdk.replay(workflow);

  check(
    "Replay consistency produces identical replayRoot",
    r1.replayRoot === r2.replayRoot,
    "Same workflow must produce the same replayRoot."
  );

  const normalDag = {
    workflowId: "purchase-demo-001",
    dag: [
      { id: "A", action: "search_product", next: "B" },
      { id: "B", action: "select_product", next: "C" },
      { id: "C", action: "checkout_request", next: null }
    ]
  };

  const mutatedDag = {
    workflowId: "purchase-demo-001",
    dag: [
      { id: "A", action: "search_product", next: "B" },
      { id: "B", action: "select_product", next: "X" },
      { id: "X", action: "unauthorized_tool_call", next: "C" },
      { id: "C", action: "checkout_request", next: null }
    ]
  };

  const ega = sdk.EGA.init({ failClosed: true });

  const normalRoot = ega.replayRoot(normalDag);
  const mutatedRoot = ega.replayRoot(mutatedDag);

  check(
    "DAG divergence changes replayRoot",
    normalRoot !== mutatedRoot,
    "Mutated DAG must not match normal DAG root."
  );

  const detection = ega.detect(mutatedDag, normalRoot);

  check(
    "DAG divergence detection returns mismatch",
    detection.status === "mismatch",
    "Expected mismatch when mutated DAG is compared against normal root."
  );

  const prov = sdk.provenance(workflow);

  check(
    "Provenance context exists",
    Boolean(prov.provenance),
    "provenance() must return provenance context."
  );

  check(
    "Provenance graph has graphId",
    typeof prov.provenance?.graphId === "string",
    "Provenance graph must include graphId."
  );

  check(
    "Provenance graph has lineage",
    Array.isArray(prov.provenance?.lineage) && prov.provenance.lineage.length > 0,
    "Provenance graph must include lineage."
  );

  const trustInput = {
    amount: 1200,
    currency: "USD",
    workflowId: "purchase-demo-001"
  };

  const trustCtx = sdk.verifyExecution(trustInput);

  check(
    "Trust state exists",
    Boolean(trustCtx.trust?.currentTier),
    "verifyExecution() must return trust.currentTier."
  );

  check(
    "Trust risk score exists",
    typeof trustCtx.trust?.riskScore === "number",
    "verifyExecution() must return trust.riskScore."
  );

  let blocked = false;
  const middleware = ega.guard();

  const req = {
    method: "POST",
    url: "/checkout",
    body: mutatedDag,
    headers: {
      "x-ega-expected-replay-root": normalRoot
    }
  };

  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    }
  };

  middleware(req, res, () => {});

  blocked =
    res.statusCode === 409 &&
    req.ega?.containment?.activated === true &&
    req.ega?.containment?.executionAllowed === false;

  check(
    "Fail-closed containment blocks mismatched workflow",
    blocked,
    "Mismatch should activate containment and block execution."
  );

  check(
    "Containment response includes EGA_CONTAINMENT_ACTIVATED",
    res.body?.error === "EGA_CONTAINMENT_ACTIVATED",
    "Blocked response must expose containment error."
  );

  console.log("\nStage B Engineering Gate Result:");
  if (failed) {
    console.log("❌ BLOCKED — Stage B engineering requirements are not complete.\n");
    process.exit(1);
  } else {
    console.log("✅ PASSED — Stage B engineering checks passed.\n");
  }
})();
