const { app, getState } = require("./app");

async function main() {
  const server = app.listen(0);

  await new Promise((resolve) =>
    server.once("listening", resolve)
  );

  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    console.log("\n=== INITIAL STATE ===");
    console.log(getState());

    console.log("\n=== PROTECTED ROUTE ===");

    const protectedResponse = await fetch(
      `${base}/protected-a`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    console.log("status:", protectedResponse.status);
    console.log("body:", await protectedResponse.text());
    console.log("state after protected:", getState());

    console.log("\n=== N+1 UNCOVERED ROUTE ===");

    const uncoveredResponse = await fetch(
      `${base}/uncovered-c`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    console.log("status:", uncoveredResponse.status);
    console.log("body:", await uncoveredResponse.text());
    console.log("state after uncovered:", getState());

  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
