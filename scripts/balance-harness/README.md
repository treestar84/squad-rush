# Balance Harness

게임 본체와 분리된 대량 밸런스 실험 도구입니다. 실제 Vite preview를 Chrome Playwright로 구동하고, `qa=monsters` 디버그 텔레메트리와 HUD 값을 반복 샘플링해 공격/방어 모드의 압박감과 스쿼드 성장감을 판정합니다.

## 목표

- 화면에 몬스터가 비어 보이지 않게 유지한다.
- 스쿼드가 단계적으로 커지는 감각이 샘플 구간 안에서 관측되게 한다.
- 난이도별로 다른 기준을 적용하되, 방어 모드는 “몬스터가 가득하고 다량 처치하는” 그림을 우선한다.

## 실행

```bash
npm run balance:harness -- --cases=defense:hard --trials=100 --report=logs/balance-harness/defense-hard.json
```

방어 모드만 반복할 때는 opt-in 프리셋을 쓴다. 이 프리셋은 공격/런 모드를 포함하지 않는다.

```bash
npm run balance:harness:defense:smoke
```

특정 압박 구간만 보려면 `mode:difficulty:window[:route]` 형식으로 고른다.

```bash
node scripts/balance-harness/cli.mjs --skip-build --allow-fail --config=scripts/balance-harness/defense.config.json --cases=defense:easy:boss_jam --trials=1 --report=logs/balance-harness/defense-boss-jam.json
```

지원하는 방어 구간은 `onboarding_crowd`, `contested_pickup`, `boss_jam`, `recovery_burst`, `final_squeeze`다. 지원하는 route 프로필은 `default`, `military-heavy`, `developer-heavy`, `unemployed-volatile`, `high-squad-stress`다.

대량 실행은 병렬 페이지 수를 올린다.

```bash
npm run balance:harness -- --cases=defense:hard --trials=1000 --concurrency=4 --allow-fail
```

빠른 개발 확인:

```bash
node scripts/balance-harness/cli.mjs --skip-build --cases=defense:easy --trials=1 --report=logs/balance-harness/smoke.json
```

밸런스 위반을 리포트로만 보고 exit code는 성공으로 받고 싶으면 `--allow-fail`을 붙인다.

## 방어 전용 워크플로우

1. 기준 리포트를 만든다.

```bash
npm run balance:harness:defense:smoke
```

2. 밸런스 상수를 사람이 한 가지 가설만 골라 수정한 뒤 같은 seed와 같은 config로 candidate 리포트를 만든다.

```bash
node scripts/balance-harness/cli.mjs --skip-build --allow-fail --config=scripts/balance-harness/defense.config.json --trials=1 --report=logs/balance-harness/defense-candidate.json
```

3. 같은 seed 비교로 pass rate, 분포, failure, recommendation 변화를 확인한다.

```bash
npm run balance:harness:compare -- --baseline=logs/balance-harness/defense-baseline.json --candidate=logs/balance-harness/defense-candidate.json
```

4. 실험 결정을 journal로 남긴다.

```bash
node scripts/balance-harness/journal.mjs --hypothesis="raise defense easy spawn pressure before health" --baseline=logs/balance-harness/defense-baseline.json --candidate=logs/balance-harness/defense-candidate.json --decision=hold --out=.omo/evidence/defense-balance-experiment.md
```

추천과 journal은 자동 패치가 아니다. 첫 루프에서는 read-only/advisory로 유지하고, `difficultyData.ts`, `gameModeData.ts`, `DefenseWaveTuning.ts`는 하네스가 수정하지 않는다.

## 설정

기본 케이스는 `defaults.mjs`에 있다. 별도 JSON 설정을 쓰려면:

```bash
node scripts/balance-harness/cli.mjs --config=scripts/balance-harness/local-config.json
```

설정 형태:

```json
{
  "sampleTimesMs": [12000, 24000, 36000],
  "cases": [
    {
      "mode": "defense",
      "difficulty": "hard",
      "trials": 100,
      "query": { "quality": "high", "qa": "monsters", "qaNoDamage": "1" },
      "targets": {
        "activeMin": 90,
        "activeMax": 360,
        "killMin": 20,
        "killMax": 180,
        "nearestMax": 12,
        "survivorMin": 1,
        "growthMin": 1,
        "visibleCoverageMin": 0.65,
        "openingActiveMax": 130
      }
    }
  ]
}
```

## 리포트 해석

JSON 리포트는 `summaries`와 `trials`를 가진다.

- `passRate`: 해당 모드/난이도 trial 중 모든 목표를 만족한 비율
- `failureCounts`: 어떤 목표가 얼마나 자주 깨졌는지
- `metrics.finalActive`: 마지막 샘플의 화면 몬스터 수 분포
- `metrics.growth`: 첫 샘플 대비 마지막 샘플의 스쿼드 수 증가량
- `metrics.visibleCoverage`: 샘플 중 visible target 하한을 만족한 비율
- `scorecard.screenPressure`: active monster, visible density, nearest threat, underfilled window 묶음
- `scorecard.massKill`: 처치 수와 boss/backlog를 볼 active pressure 묶음
- `scorecard.squadBuildUp`: soldiers, formation, roster, growth delta 묶음
- `scorecard.readability`: 조기 종료, survivor floor, overflow 묶음
- `recommendations`: 현재 난이도 조절 요소 중 먼저 만질 후보

추천은 자동 패치가 아니라 실험 노트다. 패치를 적용한 뒤 같은 명령을 다시 실행해 pass rate와 분포가 좋아지는지 비교한다.
