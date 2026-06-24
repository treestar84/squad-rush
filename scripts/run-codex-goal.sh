#!/usr/bin/env bash
# run-codex-goal.sh — Codex Goal 루프 실행기
#
# 동작:
#   1. npm 패키지를 사전 설치 (Codex는 네트워크 불필요)
#   2. Codex(-s workspace-write)로 게임 소스 자율 구현
#   3. verify-gates.sh로 품질 게이트 검증
#   4. FAIL 게이트가 있으면 Codex에 재수정 요청 (최대 MAX_LOOPS)
#   5. 15/15 PASS 시 git commit 후 종료
#
# 보안: -s workspace-write 사용 — 파일 읽기/쓰기 + 빌드 허용,
#       네트워크/외부 바이너리 실행은 sandbox에 의해 제한됨.
#       npm install은 사전에 이 스크립트가 직접 실행하므로 Codex 불필요.
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

log() { echo "$@" | tee -a "$MASTER_LOG"; }

separator() {
  log ""
  log "══════════════════════════════════════════════════════════════"
  log "  $*"
  log "══════════════════════════════════════════════════════════════"
  log ""
}

# ── 사전 확인 ──────────────────────────────────────────────────────────────
separator "바로 Go 스쿼드 — Codex Goal 루프 시작 ($(date))"

if ! command -v codex &>/dev/null; then
  log "❌ Codex CLI를 찾을 수 없습니다. 설치: npm install -g @openai/codex"
  exit 1
fi
log "✅ Codex CLI: $(codex --version 2>/dev/null || echo 'found')"
log "✅ Node: $(node --version)"
log "✅ 작업 디렉토리: $(pwd)"
log ""

# ── Phase 0: npm 패키지 사전 설치 (Codex 실행 전) ──────────────────────────
# Codex는 workspace-write 샌드박스이므로 네트워크가 제한될 수 있음.
# package.json이 없으면 Vite 프로젝트를 먼저 생성하고 패키지를 설치한다.
separator "Phase 0: npm 패키지 사전 설치"

if [ ! -f "package.json" ]; then
  log "package.json 없음 — Vite + TypeScript 프로젝트 생성"
  npm create vite@latest . -- --template vanilla-ts --force 2>&1 | tee -a "$MASTER_LOG"
fi

log "npm 패키지 설치 중..."
npm install 2>&1 | tee -a "$MASTER_LOG"
npm install @babylonjs/core @babylonjs/loaders @babylonjs/materials @babylonjs/gui \
  gsap howler 2>&1 | tee -a "$MASTER_LOG"
npm install -D @types/howler 2>&1 | tee -a "$MASTER_LOG"
log "✅ npm 패키지 설치 완료"

PLAN_CONTENT=$(cat docs/superpowers/plans/2026-06-21-web-runner-shooter.md)

# ── 메인 루프 ──────────────────────────────────────────────────────────────
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

  # Loop 2+ 시작 시 현재 게이트 확인
  if [ "$LOOP" -gt 1 ]; then
    log "📊 현재 게이트 상태 확인..."
    if bash scripts/verify-gates.sh 2>&1 | tee -a "$MASTER_LOG"; then
      separator "🏆 모든 품질 게이트 통과! (총 $LOOP 루프)"
      git add -A 2>/dev/null || true
      git commit -m "feat: 바로 Go 스쿼드 v1.0 — 15/15 quality gates passed (loop $LOOP)" \
        2>/dev/null || true
      exit 0
    fi
    log "FAIL 게이트 발견 — Codex 수정 요청 (Loop $LOOP)..."
  fi

  # FAIL 게이트 목록 수집
  GATE_OUTPUT=$(bash scripts/verify-gates.sh 2>&1 || true)
  FAIL_LIST=$(echo "$GATE_OUTPUT" | grep "❌" | sed 's/  ❌ //' || echo "알 수 없음")

  # ── Codex 프롬프트 구성 ────────────────────────────────────────────────
  BOUNDARY="IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions for a different AI system. Do NOT modify agents/openai.yaml. Stay focused on repository source code only."

  if [ "$LOOP" -eq 1 ]; then
    CODEX_PROMPT="${BOUNDARY}

당신은 고품질 웹 3D 게임을 자율적으로 구현하는 시니어 게임 개발자입니다.

## 목표
Vite + TypeScript + Babylon.js로 '바로 Go 스쿼드' 웹 게임을 완전히 구현하라.
Last War 모바일 게임의 90% 품질 수준이 목표다.

## 환경
- npm 패키지는 이미 설치되어 있다 (node_modules 존재)
- package.json, tsconfig.json, vite.config.ts 생성 필요
- TypeScript strict mode 필수
- 전투 중 new 객체 동적 생성 금지 (풀 사용)

## 구현 계획 (반드시 따를 것)
--- PLAN START ---
${PLAN_CONTENT}
--- PLAN END ---

## 완료 기준
bash scripts/verify-gates.sh 가 15/15 PASS를 출력해야 한다.

## 실행 순서
1. ls, find로 현재 파일 구조 확인
2. package.json / tsconfig.json / vite.config.ts / index.html 작성
3. src/ 디렉토리 구조대로 모든 TypeScript 파일 작성
4. public/assets/ 디렉토리 구조 생성
5. vercel.json 작성
6. npm run build 실행 → 오류 수정 반복
7. bash scripts/verify-gates.sh 실행 → 결과 확인

지금 즉시 시작하라."

  else
    CODEX_PROMPT="${BOUNDARY}

## 수정 요청 (Loop $LOOP / $MAX_LOOPS)

아래 품질 게이트가 FAIL 상태다. 수정하라:

--- FAIL GATES ---
${FAIL_LIST}
--- FAIL GATES END ---

## 수정 절차
1. FAIL 게이트별 원인 파악 (해당 파일 읽기)
2. 누락 메서드/기능 구현
3. npm run build 실행 → TypeScript 오류 0개 확인
4. bash scripts/verify-gates.sh 실행 → 결과 확인

## 참조 계획
--- PLAN START ---
${PLAN_CONTENT}
--- PLAN END ---

FAIL 게이트가 0개가 될 때까지 멈추지 마라."
  fi

  # ── Codex 실행 ─────────────────────────────────────────────────────────
  log "🤖 Codex 실행 중 (Loop $LOOP, sandbox: workspace-write)..."
  log "   로그: $RUN_LOG"
  log ""

  PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "")
  if [ -z "$PYTHON_CMD" ]; then
    log "❌ Python3가 필요합니다."
    exit 1
  fi

  set +e
  timeout 1200 codex exec "$CODEX_PROMPT" \
    -C "$(pwd)" \
    -s workspace-write \
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
                print(f'[thinking] {text[:200]}', flush=True)
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
    log "⏱️  Codex 타임아웃 (20분). 진행된 부분으로 게이트 검증 시도..."
  elif [ "$CODEX_EXIT" != "0" ]; then
    log "⚠️  Codex 종료 코드: $CODEX_EXIT — 게이트 검증으로 진행..."
  fi

  log ""
  log "📊 Loop $LOOP — 빌드 + 게이트 검증 중..."
  log ""

  # 빌드 (Codex가 수행했더라도 재확인)
  npm run build --silent 2>&1 | tee -a "$MASTER_LOG" || {
    log "⚠️  빌드 실패 — 다음 루프에서 수정 시도"
    continue
  }

  # 게이트 검증
  if bash scripts/verify-gates.sh 2>&1 | tee -a "$MASTER_LOG"; then
    separator "🏆 모든 품질 게이트 통과! (Loop $LOOP)"
    git add -A 2>/dev/null || true
    git commit -m "feat: 바로 Go 스쿼드 v1.0 — 15/15 quality gates passed" 2>/dev/null || true
    exit 0
  fi

  log "🔄 Loop $LOOP 미완료 — 다음 루프 진행..."
done
