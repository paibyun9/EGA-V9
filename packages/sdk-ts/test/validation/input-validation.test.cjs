"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EGA,
  contain,
  provenance,
  replay,
  verifyExecution,
} = require(
  "../../dist/index.js"
);

function assertEgaError(
  action,
  expected
) {
  assert.throws(
    action,
    (error) => {
      assert.equal(
        error.name,
        "EGAInputValidationError"
      );

      assert.equal(
        error.code,
        expected.code
      );

      assert.equal(
        error.field,
        expected.field
      );

      assert.equal(
        error.receivedType,
        expected.receivedType
      );

      assert.match(
        error.message,
        new RegExp(
          `^\\[${expected.code}\\]`
        )
      );

      return true;
    }
  );
}

test(
  "standalone APIs reject missing and undefined input with stable EGA errors",
  () => {
    const functions = {
      verifyExecution,
      replay,
      provenance,
      contain,
    };

    for (
      const [name, fn] of
      Object.entries(functions)
    ) {
      assertEgaError(
        () => fn(),
        {
          code:
            "EGA_INPUT_REQUIRED",
          field: "input",
          receivedType:
            "undefined",
        }
      );

      assert.match(
        (() => {
          try {
            fn(undefined);
          } catch (error) {
            return error.message;
          }

          return "";
        })(),
        new RegExp(name)
      );
    }
  }
);

test(
  "previously accepted defined standalone values remain compatible",
  () => {
    const values = [
      null,
      "execution",
      123,
      false,
      [],
      {},
    ];

    for (const value of values) {
      for (
        const fn of [
          verifyExecution,
          replay,
          provenance,
          contain,
        ]
      ) {
        const result = fn(value);

        assert.equal(
          typeof result,
          "object"
        );

        assert.equal(
          typeof result.replayRoot,
          "string"
        );

        assert.equal(
          result.replayRoot.length,
          64
        );
      }
    }
  }
);

test(
  "EGA.init rejects non-object options",
  () => {
    for (
      const value of [
        null,
        "invalid",
        123,
        false,
        [],
      ]
    ) {
      assertEgaError(
        () => EGA.init(value),
        {
          code:
            "EGA_OPTIONS_TYPE",
          field: "options",
          receivedType:
            value === null
              ? "null"
              : Array.isArray(value)
                ? "array"
                : typeof value,
        }
      );
    }
  }
);

test(
  "EGA.init validates string options",
  () => {
    assertEgaError(
      () =>
        EGA.init({
          appName: "",
        }),
      {
        code:
          "EGA_OPTION_VALUE",
        field:
          "options.appName",
        receivedType:
          "string",
      }
    );

    assertEgaError(
      () =>
        EGA.init({
          policyId: 123,
        }),
      {
        code:
          "EGA_OPTION_TYPE",
        field:
          "options.policyId",
        receivedType:
          "number",
      }
    );
  }
);

test(
  "EGA.init validates enum and boolean options",
  () => {
    assertEgaError(
      () =>
        EGA.init({
          trustLevel: "T1",
        }),
      {
        code:
          "EGA_OPTION_VALUE",
        field:
          "options.trustLevel",
        receivedType:
          "string",
      }
    );

    assertEgaError(
      () =>
        EGA.init({
          failClosed: "yes",
        }),
      {
        code:
          "EGA_OPTION_TYPE",
        field:
          "options.failClosed",
        receivedType:
          "string",
      }
    );

    assertEgaError(
      () =>
        EGA.init({
          telemetry: 1,
        }),
      {
        code:
          "EGA_OPTION_TYPE",
        field:
          "options.telemetry",
        receivedType:
          "number",
      }
    );
  }
);

test(
  "EGA.init validates approvalThreshold type and range",
  () => {
    assertEgaError(
      () =>
        EGA.init({
          approvalThreshold:
            Number.NaN,
        }),
      {
        code:
          "EGA_OPTION_TYPE",
        field:
          "options.approvalThreshold",
        receivedType:
          "number",
      }
    );

    for (const value of [-1, 101]) {
      assertEgaError(
        () =>
          EGA.init({
            approvalThreshold:
              value,
          }),
        {
          code:
            "EGA_OPTION_RANGE",
          field:
            "options.approvalThreshold",
          receivedType:
            "number",
        }
      );
    }
  }
);

test(
  "valid EGA.init options preserve normal construction",
  () => {
    const instance = EGA.init({
      appName:
        "validation-test",
      trustLevel:
        "verified",
      telemetry: false,
      failClosed: true,
      policyId:
        "test-policy",
      approvalThreshold: 70,
    });

    assert.equal(
      typeof instance.guard,
      "function"
    );

    assert.equal(
      typeof instance.replayRoot,
      "function"
    );
  }
);

test(
  "EGA.guard rejects invalid invocation arguments",
  () => {
    const middleware =
      EGA.init().guard();

    assertEgaError(
      () =>
        middleware(
          undefined,
          {},
          () => {}
        ),
      {
        code:
          "EGA_GUARD_REQUEST_REQUIRED",
        field: "req",
        receivedType:
          "undefined",
      }
    );

    assertEgaError(
      () =>
        middleware(
          {},
          undefined,
          () => {}
        ),
      {
        code:
          "EGA_GUARD_RESPONSE_REQUIRED",
        field: "res",
        receivedType:
          "undefined",
      }
    );

    assertEgaError(
      () =>
        middleware(
          {},
          {},
          undefined
        ),
      {
        code:
          "EGA_GUARD_NEXT_REQUIRED",
        field: "next",
        receivedType:
          "undefined",
      }
    );
  }
);

test(
  "error messages do not serialize sensitive input payloads",
  () => {
    const secret =
      "DO-NOT-LEAK-SECRET";

    try {
      EGA.init({
        failClosed: secret,
      });
    } catch (error) {
      assert.equal(
        error.message.includes(secret),
        false
      );

      assert.equal(
        JSON.stringify(error)
          .includes(secret),
        false
      );

      return;
    }

    assert.fail(
      "Expected validation error."
    );
  }
);
