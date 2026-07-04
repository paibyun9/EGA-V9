const express = require("express");
const { EGA } = require("../../packages/sdk-ts/dist/index.js");

const app = express();
app.use(express.json());

const ega = EGA.init({
  appName: "day-8-governance-console",
  failClosed: true,
  policyId: "checkout-policy-v1",
  approvalThreshold: 70
});

app.use((req, res, next) => {
  if (req.path === "/dashboard" || req.path.startsWith("/api/")) return next();
  return ega.guard()(req, res, next);
});

app.post("/checkout", (req, res) => {
  res.json({
    ok: true,
    message: "Execution allowed",
    ega: req.ega
  });
});

app.get("/api/events", (req, res) => {
  res.json({
    events: ega.events(),
    latestEvents: ega.latestEvents(20),
    eventSummary: ega.eventSummary()
  });
});

app.get("/api/status", (req, res) => {
  const latest = ega.latestEvents(1)[0];

  res.json({
    runtime: {
      name: "EGA V9 Governance Console",
      status: latest?.status ?? "idle",
      trustLevel: latest?.trustLevel ?? "supported",
      latestEvent: latest?.type ?? "none",
      latestReplayRoot: latest?.replayRoot ?? null,
      clientIdentity: latest?.clientIdentity ?? null,
      licenseState: latest?.licenseState ?? null
    },
    eventSummary: ega.eventSummary()
  });
});

app.get("/dashboard", (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>EGA V9 Governance Console</title>
  <style>
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b1020;
      color: #eaf0ff;
    }
    header {
      padding: 28px 36px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(135deg, #101936, #0b1020);
    }
    h1 { margin: 0; font-size: 28px; }
    .subtitle { margin-top: 8px; color: #9fb0d0; }
    main {
      padding: 28px 36px;
      display: grid;
      gap: 18px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .card {
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 20px 50px rgba(0,0,0,.25);
    }
    .card h2 {
      margin: 0 0 12px;
      font-size: 16px;
      color: #ffffff;
    }
    .value {
      font-size: 24px;
      font-weight: 700;
      margin-top: 6px;
    }
    .muted { color: #9fb0d0; font-size: 13px; }
    .ok { color: #74f2a7; }
    .warn { color: #ffd166; }
    .bad { color: #ff6b6b; }
    button {
      background: #6c7cff;
      color: white;
      border: 0;
      padding: 12px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 700;
      margin-right: 8px;
    }
    button.secondary { background: #26314f; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: rgba(0,0,0,.25);
      padding: 14px;
      border-radius: 12px;
      max-height: 360px;
      overflow: auto;
      font-size: 12px;
    }
    .event {
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
      font-size: 13px;
    }
    .event:last-child { border-bottom: 0; }
  </style>
</head>
<body>
  <header>
    <h1>EGA V9 Governance Console</h1>
    <div class="subtitle">Runtime Status · Detection · Provenance · Containment · Event Stream · License Governance</div>
  </header>

  <main>
    <section class="card">
      <h2>Demo Actions</h2>
      <button onclick="sendNormal()">Run Verified Workflow</button>
      <button class="secondary" onclick="sendMismatch()">Run Replay Mismatch</button>
      <button class="secondary" onclick="sendSuspended()">Simulate Suspended License</button>
    </section>

    <section class="grid">
      <div class="card">
        <h2>Runtime Status</h2>
        <div class="muted">Latest status</div>
        <div id="runtimeStatus" class="value">idle</div>
      </div>

      <div class="card">
        <h2>Detection</h2>
        <div class="muted">Replay mismatch count</div>
        <div id="detectionCount" class="value">0</div>
      </div>

      <div class="card">
        <h2>Containment</h2>
        <div class="muted">Containment activations</div>
        <div id="containmentCount" class="value">0</div>
      </div>

      <div class="card">
        <h2>Provenance</h2>
        <div class="muted">Latest replay root</div>
        <div id="replayRoot" class="muted">none</div>
      </div>

      <div class="card">
        <h2>Trust Escalation</h2>
        <div class="muted">Trust escalated count</div>
        <div id="trustCount" class="value">0</div>
      </div>

      <div class="card">
        <h2>License Governance</h2>
        <div class="muted">V10 seed, V9 alpha observe only</div>
        <div id="licenseState" class="value">alpha</div>
      </div>

      <div class="card">
        <h2>MITRE / ATLAS</h2>
        <div class="muted">Latest mapped technique</div>
        <div id="mitreMapping" class="value">none</div>
      </div>
    </section>

    <section class="card">
      <h2>Event Stream</h2>
      <div id="events"></div>
    </section>

    <section class="card">
      <h2>Raw Runtime JSON</h2>
      <pre id="raw">loading...</pre>
    </section>
  </main>

<script>
async function postCheckout(headers = {}, body = { item: "book", price: 100, quantity: 2, currency: "USD" }) {
  const res = await fetch("/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

  await res.json();
  await refresh();
}

async function sendNormal() {
  await postCheckout();
}

async function sendMismatch() {
  await postCheckout(
    { "x-ega-expected-replay-root": "fake-root" },
    { item: "server", price: 999, quantity: 1, currency: "USD" }
  );
}

async function sendSuspended() {
  await postCheckout(
    {
      "x-ega-license-mode": "enterprise",
      "x-ega-license-status": "suspended"
    },
    { item: "enterprise-seat", price: 500, quantity: 1, currency: "USD" }
  );
}

async function refresh() {
  const [statusRes, eventsRes] = await Promise.all([
    fetch("/api/status"),
    fetch("/api/events")
  ]);

  const status = await statusRes.json();
  const events = await eventsRes.json();

  const byType = events.eventSummary.byType || {};
  const latest = events.eventSummary.latest;

  document.getElementById("runtimeStatus").textContent = status.runtime.status;
  document.getElementById("runtimeStatus").className =
    "value " + (status.runtime.status === "contained" ? "bad" : status.runtime.status === "verified" ? "ok" : "");

  document.getElementById("detectionCount").textContent = byType["replay.mismatch"] || 0;
  document.getElementById("containmentCount").textContent = byType["containment.activated"] || 0;
  document.getElementById("trustCount").textContent = byType["trust.escalated"] || 0;
  document.getElementById("replayRoot").textContent = status.runtime.latestReplayRoot || "none";

  const license =
    (status.runtime && status.runtime.licenseState)
      ? status.runtime.licenseState
      : latest && latest.licenseState
        ? latest.licenseState
        : null;

  document.getElementById("licenseState").textContent = license
    ? license.status + " / " + license.enforcement
    : "alpha / disabled";

  const mitreEvent = [...events.events].reverse().find(e => e.type === "mitre.mapped");
  document.getElementById("mitreMapping").textContent =
    mitreEvent && mitreEvent.details
      ? mitreEvent.details.atlasTechnique + " / " + mitreEvent.details.severity
      : "none";

  document.getElementById("events").innerHTML = events.latestEvents.map(e => {
    return '<div class="event"><strong>#' + e.sequence + ' ' + e.type + '</strong><br><span class="muted">' +
      e.status + ' · ' + e.timestamp + '</span></div>';
  }).join("");

  document.getElementById("raw").textContent = JSON.stringify({ status, events }, null, 2);
}

refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`);
});

app.listen(3000, () => {
  console.log("EGA V9 Governance Console running at http://localhost:3000/dashboard");
});
