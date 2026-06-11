#!/usr/bin/env bash
#
# codex-review.sh — external (OpenAI Codex) cross-review checkpoint.
#
# A *different AI* than the Claude implementer reviews each task's changes.
# Runs `codex review` non-interactively, saves the full review to
# harness/reviews/<task>.md, and exits non-zero when Codex requests changes
# so the harness loop can react.
#
# Usage:
#   harness/codex-review.sh "Task 4: intent classifier"
#   BASE=HEAD~2 harness/codex-review.sh "Task 7: voice + AI modules"   # multi-commit task
#   MODE=uncommitted harness/codex-review.sh "Task 9: components"      # review before commit
#
# Prereqs: `codex login` completed once (uses your OpenAI account).
#
set -euo pipefail

TASK="${1:-latest task}"
BASE="${BASE:-HEAD~1}"          # what to diff against (default: the just-made commit)
MODE="${MODE:-base}"            # base | uncommitted
REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/harness/reviews"
mkdir -p "$OUT_DIR"

SLUG="$(printf '%s' "$TASK" | tr ' /:.' '-----' | tr -cd '[:alnum:]-' | sed 's/--*/-/g')"
OUT="$OUT_DIR/${SLUG:-review}.md"

# Review instructions. Pinned to the CARE design decisions so Codex checks the
# things most likely to drift, not generic style.
read -r -d '' PROMPT <<'EOF' || true
You are a SECOND-OPINION reviewer and a DIFFERENT AI from the implementer.
Review ONLY the changes under review for the 케어(CARE) React Native + Expo MVP.

Check, in priority order:
1. Correctness bugs that would crash or record wrong data (missing await, nil/undefined
   on error paths, wrong-variable copy-paste, falsy-zero treated as missing).
2. Compliance with the three pinned design decisions:
   - repeat_days: empty array [] means 매일 (every day); GPT "매일" must normalize to [].
   - intake_records: writes MUST upsert on conflict (schedule_id, scheduled_for) — no duplicate rows.
   - intent priority order: 재알림 > 미복용 > 복용완료 > 인식실패 (so "안 먹었어요" is 미복용, not 복용완료).
3. RN/Expo pitfalls: notification/mic permission handling, navigation param shapes,
   expo-av recording lifecycle, fetch error handling for Whisper/GPT calls.
4. Type consistency across files (function signatures, property names).

Be concrete: cite file:line. Do NOT rewrite the code. End with EXACTLY one line:
"VERDICT: APPROVE" or "VERDICT: CHANGES_REQUESTED".
EOF

echo "▶ Codex review — $TASK (mode=$MODE, base=$BASE)"

# NOTE: `codex review --base` cannot take a custom PROMPT (CLI constraint), so in
# base mode we rely on AGENTS.md (which encodes the 3 pinned decisions + review
# focus) for guidance. Custom PROMPT is only used in uncommitted mode.
if [ "$MODE" = "uncommitted" ]; then
  codex review --uncommitted "$PROMPT" 2>&1 | tee "$OUT"
else
  codex review --base "$BASE" 2>&1 | tee "$OUT"
fi

echo ""
echo "📝 Saved: $OUT"

# Codex echoes the reviewed diff first, then prints its analysis after a lone
# "codex" marker line. The diff can contain finding bullets / CHANGES_REQUESTED
# strings (e.g. when harness files are in scope), so we must judge the verdict
# ONLY from the analysis section — everything after the LAST "^codex$" line.
ANALYSIS="$(awk '/^codex$/{last=NR} {l[NR]=$0} END{for(i=last+1;i<=NR;i++) print l[i]}' "$OUT")"
[ -z "$ANALYSIS" ] && ANALYSIS="$(cat "$OUT")"   # fallback if no marker found

# Codex lists each finding as a line beginning "- [P0]".."- [P3]". Match only those
# leading bullets (not severity tags quoted in prose); treat P0/P1/P2 as actionable
# (P3 = nit). `|| true` keeps `set -e` from aborting when there are zero findings.
FINDINGS="$(printf '%s\n' "$ANALYSIS" | grep -Ec '^[[:space:]]*-[[:space:]]*\[P[012]\]' || true)"
if printf '%s\n' "$ANALYSIS" | grep -qiE 'VERDICT:[[:space:]]*CHANGES_REQUESTED' || [ "${FINDINGS:-0}" -gt 0 ]; then
  echo "❌ Codex requested changes (${FINDINGS:-0} actionable finding(s): P0/P1/P2)."
  exit 1
fi
echo "✅ Codex approved (no P0/P1/P2 findings)."
exit 0
