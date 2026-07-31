import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "fs";

import {
  homedir
} from "os";

import {
  dirname,
  join
} from "path";

import {
  randomUUID
} from "crypto";

const LICENSE_FILE_NAME =
  "evaluation-license.key";

const LICENSE_KEY_PATTERN =
  /^EGA9-LIC-V1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const MAX_LICENSE_KEY_BYTES =
  64 * 1024;

export type EGALicenseStoreOptions = {
  /**
   * Optional explicit directory.
   *
   * Primarily used for tests and controlled deployments.
   */
  baseDirectory?: string;

  /**
   * Optional platform override.
   *
   * Primarily used for tests.
   */
  platform?: NodeJS.Platform;

  /**
   * Optional home-directory override.
   *
   * Primarily used for tests.
   */
  homeDirectory?: string;

  /**
   * Optional environment-variable override.
   *
   * Primarily used for tests.
   */
  environment?: NodeJS.ProcessEnv;
};

export type EGASaveLicenseOptions =
  EGALicenseStoreOptions & {
    overwrite?: boolean;
  };

export class EGALicenseStoreError
  extends Error {
  readonly code:
    | "EGA_LICENSE_STORE_KEY"
    | "EGA_LICENSE_STORE_EXISTS"
    | "EGA_LICENSE_STORE_PATH"
    | "EGA_LICENSE_STORE_READ"
    | "EGA_LICENSE_STORE_WRITE";

  constructor(
    code: EGALicenseStoreError["code"],
    message: string
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "EGALicenseStoreError";

    this.code =
      code;

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function validateEvaluationLicenseKey(
  evaluationLicenseKey: string
): string {
  if (
    typeof evaluationLicenseKey !==
      "string" ||
    evaluationLicenseKey.trim().length === 0
  ) {
    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_KEY",
      "Evaluation License Key is required."
    );
  }

  const normalizedKey =
    evaluationLicenseKey.trim();

  if (
    Buffer.byteLength(
      normalizedKey,
      "utf8"
    ) > MAX_LICENSE_KEY_BYTES
  ) {
    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_KEY",
      "Evaluation License Key exceeds the maximum supported size."
    );
  }

  if (
    !LICENSE_KEY_PATTERN.test(
      normalizedKey
    )
  ) {
    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_KEY",
      "Evaluation License Key has an unsupported format."
    );
  }

  return normalizedKey;
}

function resolveLicenseDirectory(
  options: EGALicenseStoreOptions = {}
): string {
  if (
    typeof options.baseDirectory ===
      "string" &&
    options.baseDirectory.trim().length > 0
  ) {
    return options.baseDirectory;
  }

  const platform =
    options.platform ??
    process.platform;

  const homeDirectory =
    options.homeDirectory ??
    homedir();

  const environment =
    options.environment ??
    process.env;

  if (platform === "win32") {
    const appData =
      environment.APPDATA?.trim();

    return join(
      appData ||
        join(
          homeDirectory,
          "AppData",
          "Roaming"
        ),
      "ega-v9"
    );
  }

  if (platform === "darwin") {
    return join(
      homeDirectory,
      "Library",
      "Application Support",
      "ega-v9"
    );
  }

  const xdgConfigHome =
    environment.XDG_CONFIG_HOME?.trim();

  return join(
    xdgConfigHome ||
      join(
        homeDirectory,
        ".config"
      ),
    "ega-v9"
  );
}

export function resolveEvaluationLicensePath(
  options: EGALicenseStoreOptions = {}
): string {
  return join(
    resolveLicenseDirectory(options),
    LICENSE_FILE_NAME
  );
}

function assertSafeExistingFile(
  filePath: string
): void {
  const fileStatus =
    lstatSync(filePath);

  if (
    fileStatus.isSymbolicLink() ||
    !fileStatus.isFile()
  ) {
    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_PATH",
      "Evaluation License path must be a regular file and must not be a symbolic link."
    );
  }
}

export function saveEvaluationLicenseKey(
  evaluationLicenseKey: string,
  options: EGASaveLicenseOptions = {}
): string {
  const normalizedKey =
    validateEvaluationLicenseKey(
      evaluationLicenseKey
    );

  const filePath =
    resolveEvaluationLicensePath(
      options
    );

  const directoryPath =
    dirname(filePath);

  try {
    mkdirSync(
      directoryPath,
      {
        recursive: true,
        mode: 0o700
      }
    );

    if (process.platform !== "win32") {
      chmodSync(
        directoryPath,
        0o700
      );
    }

    if (existsSync(filePath)) {
      assertSafeExistingFile(
        filePath
      );

      if (!options.overwrite) {
        throw new EGALicenseStoreError(
          "EGA_LICENSE_STORE_EXISTS",
          "An Evaluation License Key is already stored. Explicit overwrite approval is required."
        );
      }
    }

    const temporaryPath =
      `${filePath}.tmp-${process.pid}-${randomUUID()}`;

    try {
      writeFileSync(
        temporaryPath,
        `${normalizedKey}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx"
        }
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          temporaryPath,
          0o600
        );
      }

      if (
        options.overwrite &&
        existsSync(filePath)
      ) {
        rmSync(
          filePath,
          {
            force: true
          }
        );
      }

      renameSync(
        temporaryPath,
        filePath
      );

      if (
        process.platform !==
          "win32"
      ) {
        chmodSync(
          filePath,
          0o600
        );
      }
    } finally {
      if (
        existsSync(temporaryPath)
      ) {
        rmSync(
          temporaryPath,
          {
            force: true
          }
        );
      }
    }

    return filePath;
  } catch (error) {
    if (
      error instanceof
      EGALicenseStoreError
    ) {
      throw error;
    }

    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_WRITE",
      `Unable to store the Evaluation License Key: ${
        error instanceof Error
          ? error.message
          : "unknown error"
      }`
    );
  }
}

export function readEvaluationLicenseKey(
  options: EGALicenseStoreOptions = {}
): string | null {
  const filePath =
    resolveEvaluationLicensePath(
      options
    );

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    assertSafeExistingFile(
      filePath
    );

    const fileStatus =
      statSync(filePath);

    if (
      fileStatus.size >
      MAX_LICENSE_KEY_BYTES
    ) {
      throw new EGALicenseStoreError(
        "EGA_LICENSE_STORE_KEY",
        "Stored Evaluation License Key exceeds the maximum supported size."
      );
    }

    const storedKey =
      readFileSync(
        filePath,
        "utf8"
      );

    return validateEvaluationLicenseKey(
      storedKey
    );
  } catch (error) {
    if (
      error instanceof
      EGALicenseStoreError
    ) {
      throw error;
    }

    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_READ",
      `Unable to read the Evaluation License Key: ${
        error instanceof Error
          ? error.message
          : "unknown error"
      }`
    );
  }
}

export function deleteEvaluationLicenseKey(
  options: EGALicenseStoreOptions = {}
): boolean {
  const filePath =
    resolveEvaluationLicensePath(
      options
    );

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    assertSafeExistingFile(
      filePath
    );

    rmSync(
      filePath,
      {
        force: true
      }
    );

    return true;
  } catch (error) {
    if (
      error instanceof
      EGALicenseStoreError
    ) {
      throw error;
    }

    throw new EGALicenseStoreError(
      "EGA_LICENSE_STORE_WRITE",
      `Unable to delete the Evaluation License Key: ${
        error instanceof Error
          ? error.message
          : "unknown error"
      }`
    );
  }
}
