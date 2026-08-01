export type EGACommercialUpgradeStatus =
  | "pending"
  | "approved"
  | "rejected";

export type EGACommercialRequestResult = {
  created: boolean;
  requestId: string;
  status:
    EGACommercialUpgradeStatus;
};

export type EGACommercialStatusResult = {
  requested: boolean;
  requestId:
    string | null;
  status:
    EGACommercialUpgradeStatus |
    null;
  rejectionReason?:
    string | null;
  commercialLicenseKey?:
    string | null;
};

export type EGACommercialApiClientOptions = {
  apiBaseUrl: string;
  fetchImplementation?:
    typeof fetch;
  timeoutMilliseconds?:
    number;
};

export class EGACommercialApiError
  extends Error {
  readonly code:
    | "EGA_COMMERCIAL_API_CONFIG"
    | "EGA_COMMERCIAL_API_NETWORK"
    | "EGA_COMMERCIAL_API_RESPONSE";

  constructor(
    code:
      EGACommercialApiError["code"],
    message: string
  ) {
    super(
      `[${code}] ${message}`
    );

    this.name =
      "EGACommercialApiError";

    this.code =
      code;

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

function normalizeBaseUrl(
  value: string
): string {
  let url:
    URL;

  try {
    url =
      new URL(
        value.trim()
      );
  } catch {
    throw new EGACommercialApiError(
      "EGA_COMMERCIAL_API_CONFIG",
      "Commercial License API URL is invalid."
    );
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
    throw new EGACommercialApiError(
      "EGA_COMMERCIAL_API_CONFIG",
      "Commercial License API must use HTTPS except for localhost development."
    );
  }

  return url
    .toString()
    .replace(
      /\/$/,
      ""
    );
}

export function createCommercialApiClient(
  options:
    EGACommercialApiClientOptions
) {
  const baseUrl =
    normalizeBaseUrl(
      options.apiBaseUrl
    );

  const fetchImplementation =
    options.fetchImplementation ??
    fetch;

  const timeoutMilliseconds =
    options.timeoutMilliseconds ??
    10_000;

  async function request(
    path: string,
    method: "GET" | "POST",
    licenseKey: string
  ): Promise<unknown> {
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
            `${baseUrl}${path}`,
            {
              method,
              headers: {
                accept:
                  "application/json",
                authorization:
                  `Bearer ${licenseKey}`
              },
              signal:
                controller.signal
            }
          );
      } catch (error) {
        throw new EGACommercialApiError(
          "EGA_COMMERCIAL_API_NETWORK",
          error instanceof Error
            ? error.message
            : "Unable to contact the Commercial License API."
        );
      }

      let body:
        any;

      try {
        body =
          await response.json();
      } catch {
        throw new EGACommercialApiError(
          "EGA_COMMERCIAL_API_RESPONSE",
          "Commercial License API returned invalid JSON."
        );
      }

      if (!response.ok) {
        throw new EGACommercialApiError(
          "EGA_COMMERCIAL_API_RESPONSE",
          body?.error?.message ??
          "Commercial License API rejected the request."
        );
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async requestUpgrade(
      licenseKey: string
    ): Promise<
      EGACommercialRequestResult
    > {
      return await request(
        "/api/licenses/commercial/request",
        "POST",
        licenseKey
      ) as
        EGACommercialRequestResult;
    },

    async getStatus(
      licenseKey: string
    ): Promise<
      EGACommercialStatusResult
    > {
      return await request(
        "/api/licenses/commercial/status",
        "GET",
        licenseKey
      ) as
        EGACommercialStatusResult;
    }
  };
}
