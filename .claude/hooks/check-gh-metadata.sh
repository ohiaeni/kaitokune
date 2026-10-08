#!/usr/bin/env bash
# gh issue create / gh pr create に必要な情報（ラベル・担当者・マイルストーン・Project・issue との紐付け）が
# 付いていなければ実行を止める。ルールは CLAUDE.md の「issue・PR の運用」を参照。
set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty')

# gh issue create / gh pr create を含まないコマンドは対象外
if ! grep -Eq '(^|[^[:alnum:]_-])gh[[:space:]]+(issue|pr)[[:space:]]+create([[:space:]]|$)' <<<"$cmd"; then
  exit 0
fi

missing=()
grep -Eq '(^|[[:space:]])(--label|-l)([[:space:]=]|$)' <<<"$cmd" || missing+=("ラベル（--label）")
grep -Eq '(^|[[:space:]])(--assignee|-a)([[:space:]=]|$)' <<<"$cmd" || missing+=("担当者（--assignee @me）")
grep -Eq '(^|[[:space:]])(--milestone|-m)([[:space:]=]|$)' <<<"$cmd" || missing+=("マイルストーン（--milestone）")
grep -Eq '(^|[[:space:]])(--project|-p)([[:space:]=]|$)' <<<"$cmd" || missing+=("Project（--project）")
if grep -Eq 'gh[[:space:]]+pr[[:space:]]+create' <<<"$cmd"; then
  grep -Eq 'Closes #[0-9$]' <<<"$cmd" || missing+=("本文の Closes #<issue 番号>")
fi

if ((${#missing[@]} > 0)); then
  reason="issue・PR の作成に必要な情報が足りません: $(IFS='、'; echo "${missing[*]}")。CLAUDE.md の「issue・PR の運用」に従って付け直してください。"
  jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
fi
