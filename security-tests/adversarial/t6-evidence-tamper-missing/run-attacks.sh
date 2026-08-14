#!/usr/bin/env bash

set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

TARGET="publication/evidence/v1.0.1/fail-closed-runtime-blocking.json"

OUTDIR="security-tests/adversarial/t6-evidence-tamper-missing/evidence/attack-runs"

BACKUP="/tmp/t6-fail-closed-runtime-blocking.original.json"

mkdir -p "$OUTDIR"

if [ ! -s "$TARGET" ]; then
  echo "STOP: canonical evidence missing."
  exit 1
fi

cp -p \
"$TARGET" \
"$BACKUP"

restore_original() {
  if [ -f "$BACKUP" ]; then
    cp -p \
    "$BACKUP" \
    "$TARGET"
  fi
}

cleanup() {
  restore_original
}

trap cleanup EXIT INT TERM

run_fail_closed_gate() {
  local name="$1"

  set +e

  node \
  scripts/v1.0.1-fail-closed-runtime-gate.cjs \
  > "$OUTDIR/${name}.fail-closed.stdout.txt" \
  2> "$OUTDIR/${name}.fail-closed.stderr.txt"

  local status=$?

  set -e

  printf '%s\n' "$status" \
  > "$OUTDIR/${name}.fail-closed.exit.txt"

  return 0
}

run_seven_test_gate() {
  local name="$1"

  set +e

  node \
  scripts/v1.0.1-seven-test-baseline.cjs \
  > "$OUTDIR/${name}.seven-test.stdout.txt" \
  2> "$OUTDIR/${name}.seven-test.stderr.txt"

  local status=$?

  set -e

  printf '%s\n' "$status" \
  > "$OUTDIR/${name}.seven-test.exit.txt"

  return 0
}

run_both() {
  local name="$1"

  echo
  echo "----------------------------------------"
  echo "ATTACK: $name"
  echo "----------------------------------------"

  run_fail_closed_gate "$name"
  run_seven_test_gate "$name"

  echo "fail-closed exit: $(
    cat "$OUTDIR/${name}.fail-closed.exit.txt"
  )"

  echo "seven-test exit: $(
    cat "$OUTDIR/${name}.seven-test.exit.txt"
  )"
}

# ========================================
# CONTROL
# ========================================

restore_original

run_both \
"control"

# ========================================
# ATTACK 1 - MISSING FILE
# ========================================

restore_original

rm -f \
"$TARGET"

run_both \
"missing-file"

# ========================================
# ATTACK 2 - MISSING ASSERTIONS
# ========================================

restore_original

node <<'NODE'
const fs = require("node:fs");

const file =
  "publication/evidence/v1.0.1/" +
  "fail-closed-runtime-blocking.json";

const evidence =
  JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );

delete evidence.assertions;

fs.writeFileSync(
  file,
  JSON.stringify(
    evidence,
    null,
    2
  ) + "\n"
);
NODE

run_both \
"missing-assertions"

# ========================================
# ATTACK 3 - FALSE ASSERTION,
# finalStatus remains PASS
# ========================================

restore_original

node <<'NODE'
const fs = require("node:fs");

const file =
  "publication/evidence/v1.0.1/" +
  "fail-closed-runtime-blocking.json";

const evidence =
  JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );

evidence.assertions = {
  ...(evidence.assertions ?? {}),
  repeatedSideEffectsZero:
    false
};

evidence.finalStatus =
  "PASS";

fs.writeFileSync(
  file,
  JSON.stringify(
    evidence,
    null,
    2
  ) + "\n"
);
NODE

run_both \
"false-assertion-pass"

# ========================================
# ATTACK 4 - EXECUTION EVIDENCE TAMPER
# Pretend duplicate/forbidden execution
# occurred while finalStatus stays PASS.
# ========================================

restore_original

node <<'NODE'
const fs = require("node:fs");

const file =
  "publication/evidence/v1.0.1/" +
  "fail-closed-runtime-blocking.json";

const evidence =
  JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );

if (!evidence.failClosed) {
  evidence.failClosed = {};
}

evidence.failClosed.downstreamCalls =
  1;

evidence.failClosed.purchaseCalls =
  1;

evidence.failClosed.toolCalls =
  1;

evidence.failClosed.executionAllowed =
  true;

evidence.finalStatus =
  "PASS";

fs.writeFileSync(
  file,
  JSON.stringify(
    evidence,
    null,
    2
  ) + "\n"
);
NODE

run_both \
"execution-tamper-pass"

# ========================================
# ATTACK 5 - REPEATED SIDE EFFECT TAMPER
# ========================================

restore_original

node <<'NODE'
const fs = require("node:fs");

const file =
  "publication/evidence/v1.0.1/" +
  "fail-closed-runtime-blocking.json";

const evidence =
  JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );

if (!evidence.repeatedFailClosed) {
  evidence.repeatedFailClosed = {};
}

evidence.repeatedFailClosed
  .totalDownstreamCalls =
  1;

evidence.repeatedFailClosed
  .totalPurchaseCalls =
  1;

evidence.repeatedFailClosed
  .totalToolCalls =
  1;

evidence.finalStatus =
  "PASS";

fs.writeFileSync(
  file,
  JSON.stringify(
    evidence,
    null,
    2
  ) + "\n"
);
NODE

run_both \
"repeated-side-effect-pass"

# ========================================
# ATTACK 6 - REMOVE finalStatus
# ========================================

restore_original

node <<'NODE'
const fs = require("node:fs");

const file =
  "publication/evidence/v1.0.1/" +
  "fail-closed-runtime-blocking.json";

const evidence =
  JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );

delete evidence.finalStatus;

fs.writeFileSync(
  file,
  JSON.stringify(
    evidence,
    null,
    2
  ) + "\n"
);
NODE

run_both \
"missing-final-status"

# ========================================
# ATTACK 7 - TRUNCATED / INVALID JSON
# ========================================

restore_original

printf '%s\n' \
'{"schemaVersion":"1.0.0","finalStatus":"PASS",' \
> "$TARGET"

run_both \
"truncated-json"

# ========================================
# RESTORE
# ========================================

restore_original

echo
echo "========================================"
echo "T6 ATTACK RUN COMPLETE"
echo "========================================"

echo
echo "Restored evidence hash:"

shasum -a 256 \
"$TARGET"
