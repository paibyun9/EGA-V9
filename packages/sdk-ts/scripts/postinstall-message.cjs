"use strict";

const message = [
  "",
  "EGA V9 installed successfully.",
  "",
  "License Activation is required before governed execution.",
  "",
  "Next step:",
  "  npx ega-v9 register",
  ""
].join("\n");

process.stdout.write(message);
