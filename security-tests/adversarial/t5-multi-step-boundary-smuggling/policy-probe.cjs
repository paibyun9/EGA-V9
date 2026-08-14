"use strict";

const {
  ega,
} = require(
  "../../../packages/sdk-ts/dist/index.js"
);

const candidates = {
  singleSmall: {
    steps: [
      {
        action: "select_product",
        item: "laptop",
        quantity: 1,
      },
    ],
  },

  twoSmall: {
    steps: [
      {
        action: "select_product",
        item: "laptop",
        quantity: 1,
      },
      {
        action: "checkout_request",
        item: "laptop",
        quantity: 1,
        approved: true,
      },
    ],
  },

  quantity10: {
    steps: [
      {
        action: "search_product",
        item: "laptop",
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 10,
      },
      {
        action: "checkout_request",
        item: "laptop",
        quantity: 10,
        approved: true,
      },
    ],
  },

  quantity100: {
    steps: [
      {
        action: "search_product",
        item: "laptop",
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 100,
      },
      {
        action: "checkout_request",
        item: "laptop",
        quantity: 100,
        approved: true,
      },
    ],
  },

  quantity999: {
    steps: [
      {
        action: "search_product",
        item: "laptop",
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 999,
      },
      {
        action: "checkout_request",
        item: "laptop",
        quantity: 999,
        approved: true,
      },
    ],
  },

  splitQuantity: {
    steps: [
      {
        action: "select_product",
        item: "laptop",
        quantity: 250,
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 250,
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 250,
      },
      {
        action: "select_product",
        item: "laptop",
        quantity: 249,
      },
      {
        action: "checkout_request",
        item: "laptop",
        approved: true,
      },
    ],
  },
};

function createResponse() {
  return {
    statusCode: 200,

    setHeader() {},

    status(code) {
      this.statusCode =
        code;

      return this;
    },

    json(body) {
      this.body =
        body;
    },
  };
}

async function runCandidate(
  name,
  workflow
) {
  const request = {
    method: "POST",

    path:
      "/t5/policy-probe",

    originalUrl:
      "/t5/policy-probe",

    url:
      "/t5/policy-probe",

    body: {
      workflow:
        structuredClone(
          workflow
        ),
    },

    query: {},
    params: {},

    headers: {
      host:
        "localhost",
    },
  };

  const response =
    createResponse();

  let nextCalls = 0;

  const middleware =
    ega.guard({
      mode:
        "fail-closed",
    });

  let resolveCompleted;
  let rejectCompleted;

  const completed =
    new Promise(
      (resolve, reject) => {
        resolveCompleted =
          resolve;

        rejectCompleted =
          reject;
      }
    );

  const timeout =
    setTimeout(
      () =>
        rejectCompleted(
          new Error(
            `${name}: timeout`
          )
        ),
      2000
    );

  try {
    middleware(
      request,
      response,
      (error) => {
        nextCalls += 1;

        if (error) {
          rejectCompleted(
            error
          );

          return;
        }

        resolveCompleted();
      }
    );

    /*
     * Normal, non-contained requests use
     * next(). Contained requests use json().
     *
     * Give synchronous containment a chance
     * to resolve without changing EGA.
     */
    if (response.body) {
      resolveCompleted();
    }

    await completed;
  } finally {
    clearTimeout(
      timeout
    );
  }

  const verification =
    request.egaDecision
      ?.verification ??
    request.ega ??
    null;

  return {
    name,

    nextCalls,

    status:
      verification?.status ??
      null,

    trustState:
      request.egaDecision
        ?.trustState ??
      verification
        ?.trust
        ?.currentTier ??
      null,

    riskScore:
      verification
        ?.trust
        ?.riskScore ??
      null,

    approvalRequired:
      verification
        ?.trust
        ?.approvalRequired ??
      null,

    privilegeEscalationGate:
      verification
        ?.trust
        ?.privilegeEscalationGate ??
      null,

    executionAllowed:
      request.egaDecision
        ?.executionAllowed ??
      verification
        ?.containment
        ?.executionAllowed ??
      null,

    containmentActivated:
      verification
        ?.containment
        ?.activated ??
      null,

    businessMetrics:
      verification
        ?.provenance
        ?.businessMetrics ??
      null,

    businessGovernanceProfile:
      verification
        ?.businessGovernanceProfile ??
      verification
        ?.provenance
        ?.businessGovernanceProfile ??
      null,
  };
}

(async () => {
  const results = [];

  for (
    const [
      name,
      workflow,
    ] of Object.entries(
      candidates
    )
  ) {
    results.push(
      await runCandidate(
        name,
        workflow
      )
    );
  }

  console.log();
  console.log(
    "=== T5 NATIVE POLICY PROBE ==="
  );

  for (
    const result
    of results
  ) {
    console.log();
    console.log(
      `--- ${result.name} ---`
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );
  }
})().catch(
  (error) => {
    console.error(
      error
    );

    process.exitCode =
      1;
  }
);
