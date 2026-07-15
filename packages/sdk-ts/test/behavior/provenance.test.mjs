import test from "node:test";
import assert from "node:assert/strict";

import { ega } from "../../dist/index.js";

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

const MUTATED_WORKFLOW = [
  {
    step: 1,
    action: "search_product",
    item: "laptop"
  },
  {
    step: 2,
    action: "select_product",
    item: "laptop",
    quantity: 999
  },
  {
    step: 3,
    action: "checkout_request",
    item: "laptop",
    quantity: 999,
    approved: true
  }
];

const INVALID_EXPECTED_REPLAY_ROOT =
  "deliberately-invalid-replay-root";

function createResponse(onJson = () => {}) {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,

    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] =
        String(value);
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

function findNode(graph, type) {
  return graph.nodes.find(
    (node) => node.type === type
  );
}

function hasEdge(graph, fromNode, toNode, label) {
  return graph.edges.some(
    (edge) =>
      edge.from === fromNode.id &&
      edge.to === toNode.id &&
      edge.label === label
  );
}

function assertGraphShape(graph) {
  assert.ok(
    graph,
    "Provenance graph must exist."
  );

  assert.equal(
    typeof graph.graphId,
    "string",
    "Provenance graph must have a graphId."
  );

  assert.ok(
    graph.graphId.length > 0,
    "Provenance graphId must not be empty."
  );

  assert.ok(
    Array.isArray(graph.lineage),
    "Provenance lineage must be an array."
  );

  assert.deepEqual(
    graph.lineage,
    ["Decision", "Policy", "Tool Output", "Input"],
    "Provenance lineage must use the canonical reconstruction order."
  );

  assert.ok(
    Array.isArray(graph.nodes),
    "Provenance nodes must be an array."
  );

  assert.ok(
    Array.isArray(graph.edges),
    "Provenance edges must be an array."
  );

  const ids = graph.nodes.map(
    (node) => node.id
  );

  assert.equal(
    new Set(ids).size,
    ids.length,
    "Every provenance node ID must be unique."
  );

  const inputNode =
    findNode(graph, "input");

  const toolOutputNode =
    findNode(graph, "tool_output");

  const policyNode =
    findNode(graph, "policy");

  const decisionNode =
    findNode(graph, "decision");

  assert.ok(
    inputNode,
    "Input provenance node must exist."
  );

  assert.ok(
    toolOutputNode,
    "Tool-output provenance node must exist."
  );

  assert.ok(
    policyNode,
    "Policy provenance node must exist."
  );

  assert.ok(
    decisionNode,
    "Decision provenance node must exist."
  );

  assert.ok(
    hasEdge(
      graph,
      inputNode,
      toolOutputNode,
      "produces"
    ),
    "Input must produce Tool Output."
  );

  assert.ok(
    hasEdge(
      graph,
      toolOutputNode,
      policyNode,
      "evaluated by"
    ),
    "Tool Output must be evaluated by Policy."
  );

  assert.ok(
    hasEdge(
      graph,
      policyNode,
      decisionNode,
      "governs"
    ),
    "Policy must govern Decision."
  );

  for (const edge of graph.edges) {
    assert.ok(
      ids.includes(edge.from),
      `Edge source must reference an existing node: ${edge.from}`
    );

    assert.ok(
      ids.includes(edge.to),
      `Edge destination must reference an existing node: ${edge.to}`
    );
  }

  return {
    inputNode,
    toolOutputNode,
    policyNode,
    decisionNode
  };
}

async function runAllowedWorkflow() {
  const middleware = ega.guard({
    mode: "fail-closed"
  });

  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",

    body: {
      workflow: structuredClone(NORMAL_WORKFLOW)
    },

    query: {},
    params: {},

    headers: {
      host: "localhost"
    }
  };

  const response = createResponse();

  let nextCalls = 0;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Allowed provenance test timed out."
        )
      );
    }, 2000);

    Promise.resolve(
      middleware(request, response, (error) => {
        nextCalls += 1;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        resolve();
      })
    ).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return {
    request,
    response,
    nextCalls
  };
}

async function runContainedWorkflow() {
  let resolveResponse;
  let rejectResponse;

  const completed = new Promise(
    (resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    }
  );

  const middleware = ega.guard({
    mode: "fail-closed",
    statusCode: 403
  });

  const request = {
    method: "POST",
    path: "/checkout",
    originalUrl: "/checkout",
    url: "/checkout",

    body: {
      workflow: structuredClone(MUTATED_WORKFLOW)
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",
      "x-ega-expected-replay-root":
        INVALID_EXPECTED_REPLAY_ROOT
    }
  };

  const response = createResponse(
    resolveResponse
  );

  let nextCalls = 0;

  const timeout = setTimeout(() => {
    rejectResponse(
      new Error(
        "Contained provenance test timed out."
      )
    );
  }, 2000);

  try {
    await middleware(
      request,
      response,
      (error) => {
        nextCalls += 1;

        rejectResponse(
          error ??
            new Error(
              "Contained workflow must not call next()."
            )
        );
      }
    );

    await completed;
  } finally {
    clearTimeout(timeout);
  }

  return {
    request,
    response,
    nextCalls
  };
}

test(
  "verified workflow produces a complete provenance DAG",
  async () => {
    const result =
      await runAllowedWorkflow();

    assert.equal(
      result.nextCalls,
      1,
      "Verified workflow must call next() once."
    );

    assert.ok(
      result.request.ega,
      "Verification evidence must exist."
    );

    const graph =
      result.request.ega.provenance;

    const {
      inputNode,
      toolOutputNode,
      policyNode,
      decisionNode
    } = assertGraphShape(graph);

    assert.deepEqual(
      inputNode.data.body,
      NORMAL_WORKFLOW,
      "Input node must preserve the governed workflow."
    );

    assert.equal(
      toolOutputNode.data.replayRoot,
      result.request.ega.replayRoot,
      "Tool-output node must contain the actual replay root."
    );

    assert.equal(
      toolOutputNode.data.hashVerified,
      true,
      "Verified workflow must record hashVerified=true."
    );

    assert.equal(
      policyNode.data.scorpLock,
      true,
      "Policy node must record SCORP LOCK."
    );

    assert.equal(
      policyNode.data.failClosed,
      true,
      "Policy node must record fail-closed mode."
    );

    assert.equal(
      decisionNode.data.status,
      "verified",
      "Decision node must record verified status."
    );

    assert.equal(
      decisionNode.data.executionAllowed,
      true,
      "Verified provenance decision must allow execution."
    );

    assert.equal(
      result.request.ega.status,
      "verified"
    );

    assert.equal(
      result.request.ega.detection.status,
      "match"
    );

    assert.equal(
      result.request.egaDecision.verified,
      true
    );
  }
);

test(
  "replay mismatch provenance records containment evidence",
  async () => {
    const result =
      await runContainedWorkflow();

    assert.equal(
      result.nextCalls,
      0,
      "Contained workflow must not call next()."
    );

    assert.equal(
      result.response.statusCode,
      403,
      "Contained workflow must return HTTP 403."
    );

    const graph =
      result.request.ega.provenance;

    const {
      inputNode,
      toolOutputNode,
      policyNode,
      decisionNode
    } = assertGraphShape(graph);

    assert.deepEqual(
      inputNode.data.body,
      MUTATED_WORKFLOW,
      "Input node must preserve the mutated workflow."
    );

    assert.equal(
      toolOutputNode.data.replayRoot,
      result.request.ega.replayRoot,
      "Contained provenance must record the actual replay root."
    );

    assert.equal(
      toolOutputNode.data.hashVerified,
      false,
      "Replay mismatch must record hashVerified=false."
    );

    assert.equal(
      policyNode.data.failClosed,
      true,
      "Contained provenance must record fail-closed policy."
    );

    assert.equal(
      decisionNode.data.status,
      "contained",
      "Decision node must record contained status."
    );

    assert.equal(
      decisionNode.data.executionAllowed,
      false,
      "Contained provenance decision must block execution."
    );

    assert.equal(
      result.request.ega.status,
      "contained"
    );

    assert.equal(
      result.request.ega.detection.status,
      "mismatch"
    );

    assert.equal(
      result.request.ega.containment.activated,
      true
    );

    assert.equal(
      result.request.ega.containment.executionAllowed,
      false
    );

    assert.equal(
      result.request.egaDecision.containmentRequired,
      true
    );

    assert.equal(
      result.request.egaDecision.executionAllowed,
      false
    );
  }
);

test(
  "identical workflows produce structurally stable provenance",
  async () => {
    const first =
      await runAllowedWorkflow();

    const second =
      await runAllowedWorkflow();

    const firstGraph =
      first.request.ega.provenance;

    const secondGraph =
      second.request.ega.provenance;

    assert.equal(
      first.request.ega.replayRoot,
      second.request.ega.replayRoot,
      "Identical workflows must preserve replay-root stability."
    );

    assert.deepEqual(
      firstGraph.lineage,
      secondGraph.lineage,
      "Identical workflows must preserve lineage order."
    );

    assert.deepEqual(
      firstGraph.nodes.map(
        (node) => node.type
      ),
      secondGraph.nodes.map(
        (node) => node.type
      ),
      "Identical workflows must preserve provenance node types."
    );

    assert.deepEqual(
      firstGraph.edges.map(
        (edge) => edge.label
      ),
      secondGraph.edges.map(
        (edge) => edge.label
      ),
      "Identical workflows must preserve provenance edge labels."
    );

    assert.notEqual(
      firstGraph.graphId,
      secondGraph.graphId,
      "Separate executions should retain distinct graph IDs."
    );
  }
);
