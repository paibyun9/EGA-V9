"use strict";

const {
  createHash
} = require("node:crypto");

class EmailAdapterError
  extends Error {
  constructor(
    code,
    message
  ) {
    super(`[${code}] ${message}`);

    this.name =
      "EmailAdapterError";

    this.code =
      code;
  }
}

function createMockEmailAdapter(
  options = {}
) {
  const deliveries = [];

  return {
    async sendEmail(
      message
    ) {
      if (
        options.failForAddress &&
        message.to ===
          options.failForAddress
      ) {
        throw new EmailAdapterError(
          "EGA_EMAIL_PROVIDER_FAILURE",
          "Mock email delivery failed."
        );
      }

      const providerMessageId =
        `mock_${createHash(
          "sha256"
        )
          .update(
            [
              message.to,
              message.subject,
              message.text,
              String(
                deliveries.length
              )
            ].join(":"),
            "utf8"
          )
          .digest("hex")
          .slice(0, 24)}`;

      const delivery = {
        provider:
          "mock",

        providerMessageId,

        acceptedAt:
          new Date()
            .toISOString(),

        to:
          message.to,

        subject:
          message.subject,

        text:
          message.text
      };

      deliveries.push(
        delivery
      );

      return {
        provider:
          delivery.provider,

        providerMessageId:
          delivery.providerMessageId,

        acceptedAt:
          delivery.acceptedAt
      };
    },

    listDeliveries() {
      return deliveries.map(
        delivery => ({
          ...delivery
        })
      );
    }
  };
}

module.exports = {
  EmailAdapterError,
  createMockEmailAdapter
};
