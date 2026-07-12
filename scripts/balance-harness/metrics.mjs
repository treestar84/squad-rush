export function summarizeCase(caseConfig, trials) {
  const metrics = trials.map((trial) => trial.metrics)
  const failures = trials.flatMap((trial) => trial.failures)
  return {
    mode: caseConfig.mode,
    difficulty: caseConfig.difficulty,
    window: caseConfig.window ?? "full_run",
    route: caseConfig.route ?? "default",
    trials: trials.length,
    passRate: ratio(trials.filter((trial) => trial.failures.length === 0).length, trials.length),
    failureCounts: countFailures(failures),
    metrics: {
      finalActive: summarizeNumbers(metrics.map((metric) => metric.finalActive)),
      finalKills: summarizeNumbers(metrics.map((metric) => metric.finalKills)),
      finalSoldiers: summarizeNumbers(metrics.map((metric) => metric.finalSoldiers)),
      growth: summarizeNumbers(metrics.map((metric) => metric.growth)),
      nearestDistance: summarizeNumbers(metrics.map((metric) => metric.nearestDistance)),
      visibleCoverage: summarizeNumbers(metrics.map((metric) => metric.visibleCoverage)),
      openingActive: summarizeNumbers(metrics.map((metric) => metric.openingActive)),
    },
    scorecard: buildScorecard(metrics),
    recommendations: recommend(caseConfig, failures, metrics),
  }
}

export function evaluateTrial(caseConfig, samples) {
  const finalSample = samples.at(-1)
  if (finalSample === undefined) {
    return { metrics: emptyMetrics(), failures: ["no_samples"] }
  }
  const firstSample = samples[0] ?? finalSample
  const metrics = {
    finalActive: finalSample.activeMonsters,
    finalKills: finalSample.kills,
    finalSoldiers: finalSample.soldiers,
    growth: Math.max(0, finalSample.soldiers - firstSample.soldiers),
    nearestDistance: samples.reduce((nearest, sample) => Math.min(nearest, sample.nearestMonsterDistance), Number.POSITIVE_INFINITY),
    visibleCoverage: ratio(
      samples.filter((sample) => sample.visibleCombatBandDensity >= sample.visibleTargetMin).length,
      samples.length,
    ),
    visibleDensity: average(samples.map((sample) => sample.visibleCombatBandDensity)),
    visibleTargetMax: average(samples.map((sample) => sample.visibleTargetMax)),
    underfilledWindows: samples.filter((sample) => sample.visibleCombatBandDensity < sample.visibleTargetMin).length,
    maxActivePressure: finalSample.maxActivePressure,
    formationCount: finalSample.formationCount,
    rosterSize: finalSample.rosterSize,
    scrollOverflowPx: finalSample.scrollOverflowPx,
    resultVisible: finalSample.resultVisible,
    openingActive: firstSample.activeMonsters,
  }
  const failures = collectFailures(caseConfig.targets, finalSample, metrics)
  if (caseConfig.window === "boss_jam" && (metrics.finalActive < caseConfig.targets.activeMin || metrics.visibleCoverage < caseConfig.targets.visibleCoverageMin)) {
    failures.push("boss_jam_missing")
  }
  return { metrics, failures }
}

function collectFailures(targets, finalSample, metrics) {
  const failures = []
  pushIf(failures, finalSample.resultVisible, "ended_before_window")
  pushIf(failures, metrics.finalSoldiers < targets.survivorMin, "squad_overloaded")
  pushIf(failures, metrics.finalActive < targets.activeMin, "pressure_too_low")
  pushIf(failures, metrics.finalActive > targets.activeMax, "pressure_too_high")
  pushIf(failures, metrics.finalKills < targets.killMin, "kill_rate_too_low")
  pushIf(failures, metrics.finalKills > targets.killMax, "kill_rate_too_high")
  pushIf(failures, metrics.nearestDistance > targets.nearestMax, "threat_too_distant")
  pushIf(failures, metrics.growth < targets.growthMin, "growth_too_flat")
  pushIf(failures, metrics.visibleCoverage < targets.visibleCoverageMin, "visible_density_unstable")
  if (typeof targets.openingActiveMax === "number") {
    pushIf(failures, metrics.openingActive > targets.openingActiveMax, "opening_pressure_too_high")
  }
  pushIf(failures, metrics.finalActive < targets.activeMin, "empty_screen_risk")
  pushIf(failures, metrics.finalKills < targets.killMin, "mass_kill_too_low")
  pushIf(failures, metrics.growth < targets.growthMin, "growth_payoff_missing")
  pushIf(failures, metrics.scrollOverflowPx > 0, "readability_overflow")
  return failures
}

function recommend(caseConfig, failures, metrics) {
  const counts = countFailures(failures)
  const notes = []
  const finalActive = summarizeNumbers(metrics.map((metric) => metric.finalActive))
  const finalKills = summarizeNumbers(metrics.map((metric) => metric.finalKills))
  const label = `${caseConfig.mode}/${caseConfig.difficulty}/${caseConfig.window ?? "full_run"}/${caseConfig.route ?? "default"}`
  if ((counts.pressure_too_low ?? 0) > 0 || (counts.threat_too_distant ?? 0) > 0 || (counts.empty_screen_risk ?? 0) > 0) {
    notes.push(`${label} screenPressure: raise spawn pressure before health; target screen fill is low (active mean ${format(finalActive.mean)}).`)
  }
  if ((counts.pressure_too_high ?? 0) > 0 || (counts.opening_pressure_too_high ?? 0) > 0) {
    notes.push(`${label} readability: lower early pressure or active cap only when survivability/readability is failing.`)
  }
  if ((counts.kill_rate_too_high ?? 0) > 0 || (counts.boss_jam_missing ?? 0) > 0) {
    notes.push(`${label} massKill: raise regular health or late density; monsters die too quickly (kills mean ${format(finalKills.mean)}).`)
  }
  if ((counts.kill_rate_too_low ?? 0) > 0 || (counts.squad_overloaded ?? 0) > 0 || (counts.mass_kill_too_low ?? 0) > 0) {
    notes.push(`${label} massKill/readability: reduce damage or health before reducing spawn count, so the screen stays crowded.`)
  }
  if ((counts.growth_too_flat ?? 0) > 0 || (counts.growth_payoff_missing ?? 0) > 0) {
    notes.push(`${label} squadBuildUp: move a pickup or promotion payoff earlier; squad build-up is not visible inside the sample window.`)
  }
  if ((counts.visible_density_unstable ?? 0) > 0) {
    notes.push(`${label} screenPressure: tune visible target bands and DefenseWaveTuning density together.`)
  }
  return notes
}

function buildScorecard(metrics) {
  return {
    screenPressure: {
      activeMonsters: summarizeNumbers(metrics.map((metric) => metric.finalActive)),
      visibleDensity: summarizeNumbers(metrics.map((metric) => metric.visibleDensity)),
      visibleCoverage: summarizeNumbers(metrics.map((metric) => metric.visibleCoverage)),
      nearestThreat: summarizeNumbers(metrics.map((metric) => metric.nearestDistance)),
      underfilledWindows: summarizeNumbers(metrics.map((metric) => metric.underfilledWindows)),
    },
    massKill: {
      kills: summarizeNumbers(metrics.map((metric) => metric.finalKills)),
      maxActivePressure: summarizeNumbers(metrics.map((metric) => metric.maxActivePressure)),
    },
    squadBuildUp: {
      soldiers: summarizeNumbers(metrics.map((metric) => metric.finalSoldiers)),
      formationCount: summarizeNumbers(metrics.map((metric) => metric.formationCount)),
      rosterSize: summarizeNumbers(metrics.map((metric) => metric.rosterSize)),
      growthDelta: summarizeNumbers(metrics.map((metric) => metric.growth)),
    },
    readability: {
      resultVisibleEarly: summarizeNumbers(metrics.map((metric) => metric.resultVisible ? 1 : 0)),
      survivorFloor: summarizeNumbers(metrics.map((metric) => metric.finalSoldiers)),
      overflowPx: summarizeNumbers(metrics.map((metric) => metric.scrollOverflowPx)),
    },
  }
}

function emptyMetrics() {
  return {
    finalActive: 0,
    finalKills: 0,
    finalSoldiers: 0,
    growth: 0,
    nearestDistance: Number.POSITIVE_INFINITY,
    visibleCoverage: 0,
    visibleDensity: 0,
    visibleTargetMax: 0,
    underfilledWindows: 0,
    maxActivePressure: 0,
    formationCount: 0,
    rosterSize: 0,
    scrollOverflowPx: 0,
    resultVisible: true,
    openingActive: 0,
  }
}

function average(values) {
  return ratio(values.reduce((sum, value) => sum + value, 0), values.length)
}

function summarizeNumbers(values) {
  const finite = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right)
  if (finite.length === 0) {
    return { min: 0, p10: 0, mean: 0, p90: 0, max: 0 }
  }
  return {
    min: finite[0],
    p10: percentile(finite, 0.1),
    mean: finite.reduce((sum, value) => sum + value, 0) / finite.length,
    p90: percentile(finite, 0.9),
    max: finite.at(-1) ?? finite[0],
  }
}

function percentile(sorted, p) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))
  return sorted[index] ?? 0
}

function countFailures(failures) {
  return failures.reduce((counts, failure) => ({ ...counts, [failure]: (counts[failure] ?? 0) + 1 }), {})
}

function ratio(count, total) {
  return total === 0 ? 0 : count / total
}

function pushIf(failures, condition, failure) {
  if (condition) {
    failures.push(failure)
  }
}

function format(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "n/a"
}
