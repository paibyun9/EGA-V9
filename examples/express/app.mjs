import express from "express";
import { ega } from "../../packages/sdk-ts/dist/index.js";

export function createCheckoutApp() {
  const app = express();

  app.use(express.json());

  /*
   * EGA execution governance is applied before /checkout.
   *
   * Normal workflow:
   *   verification succeeds → next() → route executes
   *
   * Divergent workflow:
   *   containment required → HTTP 403 → route does not execute
   */
  app.use(
    "/checkout",
    ega.guard({
      mode: "fail-closed",
      statusCode: 403
    })
  );

  app.post("/checkout", (req, res) => {
    const decision = req.egaDecision;

    res.status(200).json({
      ok: true,
      checkoutAccepted: true,
      item: req.body?.workflow?.[0]?.item ?? null,
      quantity: req.body?.workflow?.[0]?.quantity ?? null,
      governance: {
        verified: decision?.verified ?? false,
        containmentRequired:
          decision?.containmentRequired ?? false,
        executionAllowed:
          decision?.executionAllowed ?? false,
        trustState: decision?.trustState ?? null,
        latencyMicroseconds:
          decision?.latencyMicroseconds ?? null
      }
    });
  });

  app.use((error, _req, res, _next) => {
    console.error("Express integration error:", error);

    res.status(500).json({
      ok: false,
      error: "EXPRESS_INTEGRATION_FAILURE",
      message:
        error instanceof Error
          ? error.message
          : "Unknown Express integration failure."
    });
  });

  return app;
}
