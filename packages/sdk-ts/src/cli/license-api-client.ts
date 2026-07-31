import {
  EGARegistrationInput,
  EGARegistrationResponse
} from "./register-command";

export type EGALicenseApiClientOptions = {
  baseUrl: string;
  timeoutMilliseconds?: number;
  fetchImplementation?: typeof fetch;
};

export class EGALicenseApiError
  extends Error {
  readonly code:
    | "EGA_LICENSE_API_CONFIG"
    | "EGA_LICENSE_API_NETWORK"
    | "EGA_LICENSE_API_RESPONSE";

  readonly statusCode?: number;
  readonly remoteCode?: string;

  constructor(args: {
    code: EGALicenseApiError["code"];
    message: string;
    statusCode?: number;
    remoteCode?: string;
  }) {
    super(
      `[${args.code}] ${args.message}`
    );

    this.name =
      "EGALicenseApiError";

    this.code =
      args.code;

    this.statusCode =
      args.statusCode;

    this.remoteCode =
      args.remoteCode;

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function normalizeBaseUrl(
  value: string
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new EGALicenseApiError({
      code:
        "EGA_LICENSE_API_CONFIG",
      message:
        "The License API base URL is required."
    });
  }

  let url: URL;

  try {
    url = new URL(
      value.trim()
    );
  } catch {
    throw new EGALicenseApiError({
      code:
        "EGA_LICENSE_API_CONFIG",
      message:
        "The License API base URL is invalid."
    });
  }

  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      (
        url.hostname ===
          "127.0.0.1" ||
        url.hostname ===
          "localhost"
      )
    )
  ) {
    throw new EGALicenseApiError({
      code:
        "EGA_LICENSE_API_CONFIG",
      message:
        "The License API must use HTTPS, except for localhost development."
    });
  }

  return url
    .toString()
    .replace(
      /\/$/,
      ""
    );
}

export function createLicenseApiClient(
  options:
    EGALicenseApiClientOptions
) {
  const baseUrl =
    normalizeBaseUrl(
      options.baseUrl
    );

  const timeoutMilliseconds =
    options.timeoutMilliseconds ??
    10_000;

  if (
    !Number.isInteger(
      timeoutMilliseconds
    ) ||
    timeoutMilliseconds < 1
  ) {
    throw new EGALicenseApiError({
      code:
        "EGA_LICENSE_API_CONFIG",
      message:
        "timeoutMilliseconds must be a positive integer."
    });
  }

  const fetchImplementation =
    options.fetchImplementation ??
    fetch;

  return {
    async issueEvaluationLicense(
      input:
        EGARegistrationInput
    ): Promise<EGARegistrationResponse> {
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          timeoutMilliseconds
        );

      try {
        let response:
          Response;

        try {
          response =
            await fetchImplementation(
              `${baseUrl}/api/licenses/evaluation`,
              {
                method: "POST",
                headers: {
                  "content-type":
                    "application/json",
                  "accept":
                    "application/json"
                },
                body:
                  JSON.stringify(
                    input
                  ),
                signal:
                  controller.signal
              }
            );
        } catch (error) {
          throw new EGALicenseApiError({
            code:
              "EGA_LICENSE_API_NETWORK",
            message:
              error instanceof Error
                ? error.message
                : "Unable to connect to the License API."
          });
        }

        let body:
          unknown;

        try {
          body =
            await response.json();
        } catch {
          throw new EGALicenseApiError({
            code:
              "EGA_LICENSE_API_RESPONSE",
            message:
              "The License API returned invalid JSON.",
            statusCode:
              response.status
          });
        }

        if (!response.ok) {
          const errorBody =
            body as {
              error?: {
                code?: string;
                message?: string;
              };
            };

          throw new EGALicenseApiError({
            code:
              "EGA_LICENSE_API_RESPONSE",
            message:
              errorBody.error?.message ??
              "The License API rejected the request.",
            statusCode:
              response.status,
            remoteCode:
              errorBody.error?.code
          });
        }

        const successBody =
          body as {
            evaluationLicenseKey?:
              unknown;
          };

        if (
          typeof successBody
            .evaluationLicenseKey !==
            "string" ||
          successBody
            .evaluationLicenseKey
            .trim()
            .length === 0
        ) {
          throw new EGALicenseApiError({
            code:
              "EGA_LICENSE_API_RESPONSE",
            message:
              "The License API response does not contain an Evaluation License Key.",
            statusCode:
              response.status
          });
        }

        return {
          evaluationLicenseKey:
            successBody
              .evaluationLicenseKey
              .trim()
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
