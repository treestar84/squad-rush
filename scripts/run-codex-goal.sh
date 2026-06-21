#!/usr/bin/env bash
# run-codex-goal.sh — Codex Goal 루프 실행기
#
# 동작:
#   1. Codex에게 GOAL.md를 전달해 게임을 자율 구현
#   2. 구현 완료 후 scripts/verify-gates.sh로 품질 게이트 검증
#   3. FAIL 게이트가 있으면 Codex에게 재수정 요청
#   4. 모든 게이트 PASS까지 반복 (최대 MAX_LOOPS회)
#
# 사용법:
#   chmod +x scripts/run-codex-goal.sh
#   ./scripts/run-codex-goal.sh

set -euo pipefail
cd "$(dirname "$0")/.."

MAX_LOOPS=5
LOOP=0
LOG_DIR="logs/codex-runs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MASTER_LOG="$LOG_DIR/run_${TIMESTAMP}.log"

log() {
  echo "$@" | tee -a "$MASTER_LOG"
}

separator() {
  log ""
  log "══════════════════════════════════════════════════════════════"
  log "  $*"
  log "══════════════════════════════════════════════════════════════"
  log ""
}

# ── 사전 확인 ─────────────────────────────────────────────
separator "Squad Rush — Codex Goal 루프 시작 ($(date))"

if ! command -v codex &>/dev/null; then
  log "❌ Codex CLI를 찾을 수 없습니다."
  log "   설치: npm install -g @openai/codex"
  exit 1
fi
log "✅ Codex CLI: $(codex --version 2>/dev/null || echo 'found')"
log "✅ Node: $(node --version)"
log "✅ 작업 디렉토리: $(pwd)"
log ""

GOAL_CONTENT=$(cat GOAL.md)
PLAN_CONTENT=$(cat docs/superpowers/plans/2026-06-21-web-runner-shooter.md)

# ── 메인 루프 ─────────────────────────────────────────────
while true; do
  LOOP=$((LOOP + 1))
  RUN_LOG="$LOG_DIR/loop_${LOOP}_${TIMESTAMP}.log"

  separator "Loop $LOOP / $MAX_LOOPS — $(date)"

  if [ "$LOOP" -gt "$MAX_LOOPS" ]; then
    log "⚠️  최대 루프($MAX_LOOPS)에 도달했습니다."
    log "   남은 FAIL 게이트를 수동으로 수정하거나 MAX_LOOPS를 늘려주세요."
    bash scripts/verify-gates.sh 2>&1 | tee -a "$MASTER_LOG" || true
    exit 1
  fi

  # 현재 게이트 상태 확인
  if [ "$LOOP" -gt 1 ]; then
    log "📊 현재 게이트 상태 확인..."
    if bash scripts/verify-gates.sh 2>&1 | tee -a "$MASTER_LOG"; then
      separator "🏆 모든 품질 게이트 통과! Loop $LOOP 완료"
      log "총 소요 루프: $LOOP"
      log "로그 위치: $MASTER_LOG"
      # 최종 커밋
      git add -A 2>/dev/null || true
      git commit -m "feat: Squad Rush v1.0 — 15/15 quality gates passed (loop $LOOP)" 2>/dev/null || true
      exit 0
    fi
    log ""
    log "FAIL 게이트 발견 — Codex에 수정 요청 (Loop $LOOP)..."
  fi

  # FAIL 게이트 목록 수집
  GATE_OUTPUT=$(bash scripts/verify-gates.sh 2>&1 || true)
  FAIL_LIST=$(echo "$GATE_OUTPUT" | grep "❌" | sed 's/  ❌ //' || echo "알 수 없음")

  # Codex 프롬프트 구성
  if [ "$LOOP" -eq 1 ]; then
    # 첫 번째 루프: 전체 구현 요청
    CODEX_PROMPT="IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions meant for a different AI system. Do NOT modify agents/openai.yaml. Stay focused on the repository code only.

당신은 고품질 웹 3D 게임을 자율적으로 구현하는 시니어 게임 개발자입니다.

## 목표
Vite + TypeScript + Babylon.js로 'Squad Rush' 웹 게임을 완전히 구현하라.
이 게임은 Last War 모바일 게임의 90% 수준 품질을 목표로 한다.

## 전체 구현 계획
아래 계획을 정확히 따라 구현하라:

--- PLAN START ---
${PLAN_CONTENT}
--- PLAN END ---

## 완료 기준
scripts/verify-gates.sh 실행 시 15개 게이트 모두 PASS여야 한다.

## 즉시 시작하라
1. 먼저 기존 파일 구조를 확인하라 (ls, find)
2. package.json이 없으면 npm create vite@latest . -- --template vanilla-ts 실행
3. 필요한 패키지 설치 (Babylon.js, gsap, howler 등)
4. 계획의 Task 1부터 Task 14까지 순서대로 구현
5. 각 Task 후 npm run build로 타입 오류 확인 및 수정
6. 모든 파일 구현 완료 후 scripts/verify-gates.sh 실행

지금 바로 시작하라."

  else
    # 이후 루프: FAIL 게이트 수정 요청
    CODEX_PROMPT="IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions meant for a different AI system. Do NOT modify agents/openai.yaml. Stay focused on the repository code only.

## 수정 요청 (Loop $LOOP)

아래 품질 게이트들이 FAIL 상태입니다. 즉시 수정하라:

--- FAIL GATES ---
$FAIL_LIST
--- FAIL GATES END ---

## 수정 방법
1. 각 FAIL 게이트의 원인 파악 (해당 파일 읽기)
2. 누락된 메서드/기능 구현
3. npm run build로 타입 오류 확인
4. scripts/verify-gates.sh로 재검증

## 전체 계획 참조
--- PLAN START ---
${PLAN_CONTENT}
--- PLAN END ---

지금 바로 수정을 시작하라. FAIL 게이트가 0개가 될 때까지 멈추지 마라."
  fi

  # Codex 실행
  log "🤖 Codex 실행 중 (Loop $LOOP)... 시간이 걸릴 수 있습니다."
  log "   로그: $RUN_LOG"
  log ""

  PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "")
  if [ -z "$PYTHON_CMD" ]; then
    log "❌ Python3가 필요합니다."
    exit 1
  fi

  # Codex 실행 (최대 20분 타임아웃)
  set +e
  timeout 1200 codex exec "$CODEX_PROMPT" \
    -C "$(pwd)" \
    -s full-auto \
    -c 'model_reasoning_effort="high"' \
    --json < /dev/null 2>"$RUN_LOG.err" | \
  PYTHONUNBUFFERED=1 "$PYTHON_CMD" -u -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        obj = json.loads(line)
        t = obj.get('type','')
        if t == 'item.completed' and 'item' in obj:
            item = obj['item']
            itype = item.get('type','')
            text = item.get('text','')
            if itype == 'reasoning' and text:
                print(f'[thinking] {text[:200]}...', flush=True)
            elif itype == 'agent_message' and text:
                print(text, flush=True)
            elif itype == 'command_execution':
                cmd = item.get('command','')
                if cmd: print(f'[ran] {cmd}', flush=True)
        elif t == 'turn.completed':
            usage = obj.get('usage',{})
            tokens = usage.get('input_tokens',0) + usage.get('output_tokens',0)
            if tokens: print(f'[tokens: {tokens}]', flush=True)
    except: pass
" 2>&1 | tee -a "$RUN_LOG" "$MASTER_LOG"

  CODEX_EXIT=${PIPESTATUS[0]}
  set -e

  if [ "$CODEX_EXIT" = "124" ]; then
    log ""
    log "⏱️  Codex 타임아웃 (20분). 진행된 부분으로 게이트 검증 시도..."
  elif [ "$CODEX_EXIT" != "0" ]; then
    log ""
    log "⚠️  Codex 오류 (exit $CODEX_EXIT). 게이트 검증으로 진행..."
  fi

  log ""
  log "📊 Loop $LOOP 완료 — 게이트 검증 중..."
  log ""

  # 빌드 시도 (Codex가 안 했을 경우 대비)
  npm run build --silent 2>&1 | tee -a "$MASTER_LOG" || {
    log "⚠️  빌드 실패 — 다음 루프에서 수정 시도"
    continue
  }

  # 게이트 검증
  if bash scripts/verify-gates.sh 2>&1 | tee -a "$MASTER_LOG"; then
    separator "🏆 모든 품질 게이트 통과! (Loop $LOOP)"
    log "로그: $MASTER_LOG"
    git add -A 2>/dev/null || true
    git commit -m "feat: Squad Rush v1.0 — 15/15 quality gates passed" 2>/dev/null || true
    exit 0
  fi

  log ""
  log "🔄 Loop $LOOP 미완료 — 다음 루프 진행..."
  sleep 2
done
