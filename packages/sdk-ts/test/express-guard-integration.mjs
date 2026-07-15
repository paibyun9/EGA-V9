import { createCheckoutApp } from "../../../examples/express/app.mjs";

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");

    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const app = createCheckoutApp();
const server = await listen(app);

try {
  const address = server.address();

  assert(
    address !== null && typeof address !== "string",
    "Unable to resolve the temporary Express server port."
  );

  const baseUrl = `http://127.0.0.1:${address.port}`;

  /*
   * Normal workflow
   */
  const normalResponse = await fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      workflow: [
        {
          step: 1,
          action: "checkout_request",
          item: "laptop",
          quantity: 1,
          approved: true
        }
      ]
    })
  });

  const normalBody = await normalResponse.json();

  assert(
    normalResponse.status === 200,
    `Normal workflow expected HTTP 200, received ${normalResponse.status}.`
  );

  assert(
    normalBody.checkoutAccepted === true,
    "Normal workflow did not reach the checkout route."
  );

  assert(
    normalBody.governance?.verified === true,
    "Normal workflow was not verified."
  );

  assert(
    normalBody.governance?.containmentRequired === false,
    "Normal workflow unexpectedly required containment."
  );

  assert(
    normalBody.governance?.executionAllowed === true,
    "Normal workflow was not allowed."
  );

  assert(
    typeof normalBody.governance?.latencyMicroseconds === "number",
    "Normal workflow latencyMicroseconds is not numeric."
  );

  /*
   * Mutation workflow
   */
  const mutationResponse = await fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ega-expected-replay-root":
        "deliberately-invalid-replay-root"
    },
    body: JSON.stringify({
      workflow: [
        {
          step: 1,
          action: "checkout_request",
          item: "laptop",
          quantity: 999,
          approved: true
        }
      ]
    })
  });

  const mutationBody = await mutationResponse.json();

  assert(
    mutationResponse.status === 403,
    `Mutation workflow expected HTTP 403, received ${mutationResponse.status}.`
  );

  assert(
    mutationBody.checkoutAccepted !== true,
    "Mutation workflow reached the checkout route."
  );

  assert(
    mutationBody.decision?.verified === false,
    "Mutation workflow was incorrectly verified."
  );

  assert(
    mutationBody.decision?.containmentRequired === true,
    "Mutation workflow did not require containment."
  );

  assert(
    mutationBody.decision?.executionAllowed === false,
    "Mutation workflow was not blocked."
  );

  assert(
    typeof mutationBody.decision?.latencyMicroseconds === "number",
    "Mutation workflow latencyMicroseconds is not numeric."
  );

  assert(
    mutationBody.ega?.detection?.status === "mismatch",
    "Mutation workflow did not report replay mismatch."
  );

  console.log("✅ Express normal workflow passed");
  console.log({
    statusCode: normalResponse.status,
    checkoutAccepted: normalBody.checkoutAccepted,
    verified: normalBody.governance.verified,
    containmentRequired:
      normalBody.governance.containmentRequired,
    executionAllowed:
      normalBody.governance.executionAllowed,
    latencyMicroseconds:
      normalBody.governance.latencyMicroseconds
  });

  console.log("✅ Express mutation containment passed");
  console.log({
    statusCode: mutationResponse.status,
    checkoutAccepted:
      mutationBody.checkoutAccepted ?? false,
    detectionStatus:
      mutationBody.ega?.detection?.status,
    verified:
      mutationBody.decision?.verified,
    containmentRequired:
      mutationBody.decision?.containmentRequired,
    executionAllowed:
      mutationBody.decision?.executionAllowed,
    latencyMicroseconds:
      mutationBody.decision?.latencyMicroseconds
  });
} finally {
  await close(server);
}
