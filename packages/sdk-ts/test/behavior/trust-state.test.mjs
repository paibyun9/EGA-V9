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

const RISKY_WORKFLOW = [
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
  "trust-state-test-invalid-replay-root";

function createResponse(onJson = () => {}) {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    jsonCalls: 0,

    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] =
        String(value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.jsonCalls += 1;
      this.body = body;
      onJson(body);
    }
  };
}

async function runNormalWorkflow() {
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
  let nextError;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Normal trust-state workflow timed out."
        )
      );
    }, 2000);

    Promise.resolve(
      middleware(request, response, (error) => {
        nextCalls += 1;
        nextError = error;

        clearTimeout(timeout);
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
    nextCalls,
    nextError
  };
}

async function runRiskyWorkflow() {
  let resolveResponse;
  let rejectResponse;

  const responseCompleted = new Promise(
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
      workflow: structuredClone(RISKY_WORKFLOW)
    },

    query: {},
    params: {},

    headers: {
      host: "localhost",
      "x-ega-expected-replay-root":
        INVALID_EXPECTED_REPLAY_ROOT
    }
  };

  const response = createResponse((body) => {
    resolveResponse(body);
  });

  let nextCalls = 0;

  const timeout = setTimeout(() => {
    rejectResponse(
      new Error(
        "Risky trust-state workflow timed out."
      )
    );
  }, 2000);

  try {
    await middleware(request, response, (error) => {
      nextCalls += 1;

      rejectResponse(
        error ??
          new Error(
            "Risky workflow must not call next()."
          )
      );
    });

    await responseCompleted;
  } finally {
    clearTimeout(timeout);
  }

  return {
    request,
    response,
    nextCalls
  };
}

function getResponseEvents(result) {
  assert.ok(
    Array.isArray(result.response.body?.events),
    "Containment response must contain an events array."
  );

  return result.response.body.events;
}

function findEvent(events, type) {
  return events.find(
    (event) => event.type === type
  );
}

function eventIndex(events, type) {
  return events.findIndex(
    (event) => event.type === type
  );
}

test(
  "normal workflow remains in trust tier T1",
  async () => {
    const result = await runNormalWorkflow();

    assert.equal(
      result.nextCalls,
      1,
      "Normal workflow must call next() once."
    );

    assert.equal(
      result.nextError,
      undefined,
      "Normal workflow must not pass an error."
    );

    assert.equal(
      result.response.statusCode,
      200,
      "Normal workflow must not be blocked."
    );

    assert.ok(
      result.request.ega,
      "Normal workflow evidence must exist."
    );

    assert.equal(
      result.request.ega.status,
      "verified",
      "Normal workflow must be verified."
    );

    assert.equal(
      result.request.ega.trust.currentTier,
      "T1",
      "Normal workflow must remain at T1."
    );

    assert.equal(
      result.request.ega.trust.riskScore,
      10,
      "Normal workflow risk score must be 10."
    );

    assert.equal(
      result.request.ega.trust.approvalRequired,
      false,
      "Normal workflow must not require approval."
    );

    assert.equal(
      result.request.ega.trust
        .privilegeEscalationGate,
      false,
      "Normal workflow must not activate the privilege-escalation gate."
    );

    assert.equal(
      result.request.ega.containment.activated,
      false,
      "Normal workflow must not activate containment."
    );

    assert.equal(
      result.request.ega.containment
        .executionAllowed,
      true,
      "Normal workflow execution must be allowed."
    );

    assert.equal(
      result.request.egaDecision.trustState,
      "T1",
      "Guard decision must report T1."
    );

    assert.equal(
      result.request.egaDecision.verified,
      true
    );

    assert.equal(
      result.request.egaDecision
        .containmentRequired,
      false
    );

    assert.equal(
      result.request.egaDecision
        .executionAllowed,
      true
    );
  }
);

test(
  "replay mismatch escalates trust state from T1 to T3",
  async () => {
    const result = await runRiskyWorkflow();

    assert.equal(
      result.nextCalls,
      0,
      "Escalated workflow must not call next()."
    );

    assert.equal(
      result.response.statusCode,
      403,
      "Escalated workflow must return HTTP 403."
    );

    assert.ok(
      result.request.ega,
      "Escalation evidence must exist."
    );

    assert.equal(
      result.request.ega.status,
      "contained",
      "Escalated workflow must be contained."
    );

    assert.equal(
      result.request.ega.detection.status,
      "mismatch",
      "Escalation must originate from replay mismatch."
    );

    assert.equal(
      result.request.ega.trust.currentTier,
      "T3",
      "Replay mismatch must escalate trust state to T3."
    );

    assert.equal(
      result.request.ega.trust.riskScore,
      85,
      "Replay mismatch risk score must increase to 85."
    );

    assert.equal(
      result.request.ega.trust.approvalRequired,
      true,
      "T3 workflow must require approval."
    );

    assert.equal(
      result.request.ega.trust
        .privilegeEscalationGate,
      true,
      "T3 workflow must activate the privilege-escalation gate."
    );

    assert.equal(
      result.request.ega.containment.activated,
      true,
      "T3 workflow must activate containment."
    );

    assert.equal(
      result.request.ega.containment
        .executionAllowed,
      false,
      "T3 workflow execution must be blocked."
    );

    assert.equal(
      result.request.egaDecision.trustState,
      "T3",
      "Guard decision must report T3."
    );

    assert.equal(
      result.request.egaDecision.verified,
      false
    );

    assert.equal(
      result.request.egaDecision
        .containmentRequired,
      true
    );

    assert.equal(
      result.request.egaDecision
        .executionAllowed,
      false
    );

    const events = getResponseEvents(result);

    const trustEscalatedEvent =
      findEvent(events, "trust.escalated");

    assert.ok(
      trustEscalatedEvent,
      "Evidence must contain trust.escalated."
    );

    assert.equal(
      trustEscalatedEvent.details?.from,
      "T1",
      "Trust escalation must begin at T1."
    );

    assert.equal(
      trustEscalatedEvent.details?.to,
      "T3",
      "Trust escalation must end at T3."
    );

    assert.equal(
      trustEscalatedEvent.details?.riskScore,
      85,
      "Trust escalation event must record risk score 85."
    );
  }
);

test(
  "risk and approval state change consistently between normal and risky workflows",
  async () => {
    const normal = await runNormalWorkflow();
    const risky = await runRiskyWorkflow();

    const normalTrust =
      normal.request.ega.trust;

    const riskyTrust =
      risky.request.ega.trust;

    assert.equal(
      normalTrust.currentTier,
      "T1"
    );

    assert.equal(
      riskyTrust.currentTier,
      "T3"
    );

    assert.ok(
      riskyTrust.riskScore >
        normalTrust.riskScore,
      "Risk score must increase for the risky workflow."
    );

    assert.equal(
      riskyTrust.riskScore -
        normalTrust.riskScore,
      75,
      "Current implementation must increase risk score from 10 to 85."
    );

    assert.equal(
      normalTrust.approvalRequired,
      false
    );

    assert.equal(
      riskyTrust.approvalRequired,
      true
    );

    assert.equal(
      normalTrust.privilegeEscalationGate,
      false
    );

    assert.equal(
      riskyTrust.privilegeEscalationGate,
      true
    );

    assert.equal(
      normal.request.egaDecision
        .executionAllowed,
      true
    );

    assert.equal(
      risky.request.egaDecision
        .executionAllowed,
      false
    );
  }
);

test(
  "trust escalation events occur in the required governance order",
  async () => {
    const result = await runRiskyWorkflow();
    const events = getResponseEvents(result);

    const requiredEvents = [
      "trust.evaluated",
      "trust.escalated",
      "privilege.escalation.gated",
      "approval.required",
      "containment.activated",
      "execution.blocked"
    ];

    for (const eventType of requiredEvents) {
      assert.ok(
        eventIndex(events, eventType) >= 0,
        `Evidence must contain ${eventType}.`
      );
    }

    const evaluatedIndex =
      eventIndex(events, "trust.evaluated");

    const escalatedIndex =
      eventIndex(events, "trust.escalated");

    const privilegeGateIndex =
      eventIndex(
        events,
        "privilege.escalation.gated"
      );

    const approvalIndex =
      eventIndex(events, "approval.required");

    const containmentIndex =
      eventIndex(
        events,
        "containment.activated"
      );

    const blockedIndex =
      eventIndex(events, "execution.blocked");

    assert.ok(
      escalatedIndex > evaluatedIndex,
      "trust.escalated must occur after trust.evaluated."
    );

    assert.ok(
      privilegeGateIndex > escalatedIndex,
      "privilege.escalation.gated must occur after trust.escalated."
    );

    assert.ok(
      approvalIndex > privilegeGateIndex,
      "approval.required must occur after privilege escalation is gated."
    );

    assert.ok(
      containmentIndex > approvalIndex,
      "containment.activated must occur after approval.required."
    );

    assert.ok(
      blockedIndex > containmentIndex,
      "execution.blocked must occur after containment.activated."
    );

    const evaluatedEvent =
      findEvent(events, "trust.evaluated");

    const approvalEvent =
      findEvent(events, "approval.required");

    assert.equal(
      evaluatedEvent.details?.currentTier,
      "T3",
      "Trust evaluation must record T3."
    );

    assert.equal(
      evaluatedEvent.details?.riskScore,
      85,
      "Trust evaluation must record risk score 85."
    );

    assert.equal(
      approvalEvent.details?.currentTier,
      "T3",
      "Approval event must reference T3."
    );

    assert.equal(
      approvalEvent.details?.riskScore,
      85,
      "Approval event must reference risk score 85."
    );
  }
);

test(
  "trust-state outcomes remain stable across repeated executions",
  async () => {
    const firstNormal =
      await runNormalWorkflow();

    const secondNormal =
      await runNormalWorkflow();

    const firstRisky =
      await runRiskyWorkflow();

    const secondRisky =
      await runRiskyWorkflow();

    assert.equal(
      firstNormal.request.ega.trust
        .currentTier,
      "T1"
    );

    assert.equal(
      secondNormal.request.ega.trust
        .currentTier,
      "T1"
    );

    assert.equal(
      firstNormal.request.ega.trust
        .riskScore,
      secondNormal.request.ega.trust
        .riskScore
    );

    assert.equal(
      firstRisky.request.ega.trust
        .currentTier,
      "T3"
    );

    assert.equal(
      secondRisky.request.ega.trust
        .currentTier,
      "T3"
    );

    assert.equal(
      firstRisky.request.ega.trust
        .riskScore,
      secondRisky.request.ega.trust
        .riskScore
    );

    assert.equal(
      firstRisky.request.ega.trust
        .approvalRequired,
      true
    );

    assert.equal(
      secondRisky.request.ega.trust
        .approvalRequired,
      true
    );

    assert.equal(
      firstRisky.request.egaDecision
        .executionAllowed,
      false
    );

    assert.equal(
      secondRisky.request.egaDecision
        .executionAllowed,
      false
    );
  }
);
