const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} = require("node:fs");

const {
  tmpdir
} = require("node:os");

const {
  join
} = require("node:path");

const {
  EGALicenseStoreError,
  deleteEvaluationLicenseKey,
  readEvaluationLicenseKey,
  resolveEvaluationLicensePath,
  saveEvaluationLicenseKey
} = require(
  "../../dist/license/license-store.js"
);

const TEST_KEY =
  "EGA9-LIC-V1.payload.signature";

function createTemporaryDirectory() {
  return mkdtempSync(
    join(
      tmpdir(),
      "ega-v9-license-store-"
    )
  );
}

function removeTemporaryDirectory(
  directoryPath
) {
  rmSync(
    directoryPath,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  "resolves standard operating-system license paths",
  () => {
    assert.equal(
      resolveEvaluationLicensePath({
        platform: "darwin",
        homeDirectory: "/Users/test",
        environment: {}
      }),
      join(
        "/Users/test",
        "Library",
        "Application Support",
        "ega-v9",
        "evaluation-license.key"
      )
    );

    assert.equal(
      resolveEvaluationLicensePath({
        platform: "linux",
        homeDirectory: "/home/test",
        environment: {
          XDG_CONFIG_HOME:
            "/custom/config"
        }
      }),
      join(
        "/custom/config",
        "ega-v9",
        "evaluation-license.key"
      )
    );

    assert.equal(
      resolveEvaluationLicensePath({
        platform: "win32",
        homeDirectory:
          "C:\\Users\\test",
        environment: {
          APPDATA:
            "C:\\Users\\test\\AppData\\Roaming"
        }
      }),
      join(
        "C:\\Users\\test\\AppData\\Roaming",
        "ega-v9",
        "evaluation-license.key"
      )
    );
  }
);

test(
  "stores and reads an Evaluation License Key",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    try {
      const filePath =
        saveEvaluationLicenseKey(
          TEST_KEY,
          {
            baseDirectory:
              directoryPath
          }
        );

      assert.equal(
        existsSync(filePath),
        true
      );

      assert.equal(
        readEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        TEST_KEY
      );

      assert.equal(
        readFileSync(
          filePath,
          "utf8"
        ),
        `${TEST_KEY}\n`
      );

      if (
        process.platform !==
          "win32"
      ) {
        const fileMode =
          statSync(filePath).mode &
          0o777;

        assert.equal(
          fileMode,
          0o600
        );
      }
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);

test(
  "returns null when no Evaluation License Key exists",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    try {
      assert.equal(
        readEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        null
      );
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);

test(
  "refuses to overwrite an existing Evaluation License Key by default",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    try {
      saveEvaluationLicenseKey(
        TEST_KEY,
        {
          baseDirectory:
            directoryPath
        }
      );

      assert.throws(
        () =>
          saveEvaluationLicenseKey(
            "EGA9-LIC-V1.changed.signature",
            {
              baseDirectory:
                directoryPath
            }
          ),
        (error) =>
          error instanceof
            EGALicenseStoreError &&
          error.code ===
            "EGA_LICENSE_STORE_EXISTS"
      );
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);

test(
  "allows explicit replacement of an existing Evaluation License Key",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    const replacementKey =
      "EGA9-LIC-V1.replacement.signature";

    try {
      saveEvaluationLicenseKey(
        TEST_KEY,
        {
          baseDirectory:
            directoryPath
        }
      );

      saveEvaluationLicenseKey(
        replacementKey,
        {
          baseDirectory:
            directoryPath,
          overwrite: true
        }
      );

      assert.equal(
        readEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        replacementKey
      );
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);

test(
  "deletes a stored Evaluation License Key",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    try {
      saveEvaluationLicenseKey(
        TEST_KEY,
        {
          baseDirectory:
            directoryPath
        }
      );

      assert.equal(
        deleteEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        true
      );

      assert.equal(
        readEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        null
      );

      assert.equal(
        deleteEvaluationLicenseKey({
          baseDirectory:
            directoryPath
        }),
        false
      );
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);

test(
  "rejects an invalid Evaluation License Key format",
  () => {
    const directoryPath =
      createTemporaryDirectory();

    try {
      assert.throws(
        () =>
          saveEvaluationLicenseKey(
            "not-a-license-key",
            {
              baseDirectory:
                directoryPath
            }
          ),
        (error) =>
          error instanceof
            EGALicenseStoreError &&
          error.code ===
            "EGA_LICENSE_STORE_KEY"
      );
    } finally {
      removeTemporaryDirectory(
        directoryPath
      );
    }
  }
);
