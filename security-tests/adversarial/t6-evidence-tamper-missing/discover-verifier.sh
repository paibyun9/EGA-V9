#!/usr/bin/env bash

set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "=== POSSIBLE EVIDENCE VERIFIERS ==="

grep -R -n -E \
'evidence.*verify|verify.*evidence|validate.*evidence|evidence.*integrity|integrity.*evidence|finalStatus|NOT_VERIFIED|NOT VERIFIED|CHECK|sha256|checksum|manifest' \
packages \
scripts \
publication \
test \
tests \
2>/dev/null \
| grep -v node_modules \
| head -800

echo
echo "=== POSSIBLE JSON EVIDENCE CONSUMERS ==="

grep -R -n -E \
'readFileSync|readFile|JSON\.parse' \
packages \
scripts \
publication \
test \
tests \
2>/dev/null \
| grep -E \
'evidence|manifest|publication|security' \
| head -600

echo
echo "=== PACKAGE COMMANDS ==="

node <<'NODE'
const p = require("./package.json");

for (
  const [name, command]
  of Object.entries(
    p.scripts || {}
  )
) {
  if (
    /gate|evidence|verify|publication|manifest|consistency/i
      .test(
        `${name} ${command}`
      )
  ) {
    console.log(
      `${name} => ${command}`
    );
  }
}
NODE
