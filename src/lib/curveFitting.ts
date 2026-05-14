import { mean, abs, max, median } from "mathjs"

export interface Platform {
  startIndex: number
  endIndex: number
  startTime: number
  endTime: number
  avgTemp: number      // simple mean of all points (kept for compatibility)
  fittedTemp: number   // linear-fit value at segment midpoint (more accurate)
  slope: number        // °C/s — how much the platform drifts
  r2: number           // R² of the linear fit (1 = perfect flat)
  duration: number
}

export interface SupercoolingEvent {
  platformIndex: number  // which platform (0-based)
  platformTemp: number   // fittedTemp of the platform (reference)
  minTemp: number        // lowest temperature reached before the platform
  minTime: number        // time of the supercooling minimum
  minIndex: number       // array index of the minimum
  degree: number         // platformTemp - minTemp (the supercooling degree)
}

export interface CurveAnalysis {
  totalDuration: number
  totalDrop: number
  avgCoolingRate: number
  maxCoolingRate: number
  platformCount: number
  platforms: Platform[]
  supercooling: SupercoolingEvent[]
  hasRebound: boolean
  reboundDetails: string[]
  hasFastCooling: boolean
  hasSlowCooling: boolean
  noVisiblePlatform: boolean
}

export interface AnomalyPoint {
  index: number
  time: number
  temperature: number
  delta: number
}

// ── Linear regression ─────────────────────────────────────────────────────────

interface FitResult {
  slope: number
  intercept: number
  r2: number
  valueAt: (x: number) => number
}

function linearFit(xs: number[], ys: number[]): FitResult {
  const n = xs.length
  const xMean = mean(xs) as number
  const yMean = mean(ys) as number

  let ssXX = 0
  let ssXY = 0
  let ssTot = 0

  for (let i = 0; i < n; i++) {
    ssXX += (xs[i] - xMean) ** 2
    ssXY += (xs[i] - xMean) * (ys[i] - yMean)
    ssTot += (ys[i] - yMean) ** 2
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = yMean - slope * xMean

  let ssRes = 0
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (slope * xs[i] + intercept)) ** 2
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)

  return {
    slope,
    intercept,
    r2,
    valueAt: (x: number) => slope * x + intercept,
  }
}

// Trim fraction from each end of an array (minimum 3 elements kept).
function trimEnds<T>(arr: T[], fraction = 0.15): T[] {
  const cut = Math.floor(arr.length * fraction)
  const start = cut
  const end = arr.length - cut
  return end - start >= 3 ? arr.slice(start, end) : arr
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

const ANOMALY_MIN_THRESHOLD = 5 // °C

export function detectAnomalies(
  time: number[],
  temp: number[]
): AnomalyPoint[] {
  const n = temp.length
  if (n < 2) return []

  const diffs = temp.slice(1).map((t, i) => Math.abs(t - temp[i]))
  const med = median(diffs) as number
  const threshold = Math.max(3 * med, ANOMALY_MIN_THRESHOLD)

  const anomalies: AnomalyPoint[] = []
  for (let i = 1; i < n; i++) {
    const delta = temp[i] - temp[i - 1]
    if (Math.abs(delta) > threshold) {
      anomalies.push({ index: i, time: time[i], temperature: temp[i], delta })
    }
  }
  return anomalies
}

// ── Core functions ────────────────────────────────────────────────────────────

export function smoothData(temps: number[]): number[] {
  const n = temps.length
  if (n === 0) return []
  return temps.map((_, i) => {
    if (i === 0 || i === n - 1) return temps[i]
    return (temps[i - 1] + temps[i] + temps[i + 1]) / 3
  })
}

export function detectPlatforms(time: number[], temp: number[]): Platform[] {
  const n = temp.length
  if (n < 3) return []

  const flat: boolean[] = new Array(n).fill(false)
  for (let i = 0; i < n - 1; i++) {
    if ((abs(temp[i + 1] - temp[i]) as number) < 1.5) {
      flat[i] = true
      flat[i + 1] = true
    }
  }

  const rawSegments: Array<{ start: number; end: number }> = []
  let segStart: number | null = null

  for (let i = 0; i < n; i++) {
    if (flat[i]) {
      if (segStart === null) segStart = i
    } else {
      if (segStart !== null) {
        if (i - segStart >= 3) rawSegments.push({ start: segStart, end: i - 1 })
        segStart = null
      }
    }
  }
  if (segStart !== null && n - segStart >= 3) {
    rawSegments.push({ start: segStart, end: n - 1 })
  }

  const merged: Array<{ start: number; end: number }> = []
  for (const seg of rawSegments) {
    if (merged.length > 0 && seg.start - merged[merged.length - 1].end <= 1) {
      merged[merged.length - 1].end = seg.end
    } else {
      merged.push({ ...seg })
    }
  }

  return merged.map(({ start, end }) => {
    const segTime = time.slice(start, end + 1)
    const segTemp = temp.slice(start, end + 1)
    const avgTemp = mean(segTemp) as number

    // Linear fit on trimmed middle 70% to reduce boundary noise
    const trimmedTime = trimEnds(segTime)
    const trimmedTemp = trimEnds(segTemp)
    const fit = linearFit(trimmedTime, trimmedTemp)
    const midTime = (time[start] + time[end]) / 2
    const fittedTemp = fit.valueAt(midTime)

    return {
      startIndex: start,
      endIndex: end,
      startTime: time[start],
      endTime: time[end],
      avgTemp,
      fittedTemp,
      slope: fit.slope,
      r2: fit.r2,
      duration: time[end] - time[start],
    }
  })
}

export function computeCoolingRates(time: number[], temp: number[]): number[] {
  const n = temp.length
  if (n === 0) return []
  if (n === 1) return [0]

  return temp.map((_, i) => {
    const dt = i === 0 ? time[1] - time[0] : time[i] - time[i - 1]
    const dTemp = i === 0 ? temp[1] - temp[0] : temp[i] - temp[i - 1]
    return dt === 0 ? 0 : -dTemp / dt
  })
}

// ── Supercooling detection ────────────────────────────────────────────────────
// Look at up to LOOKBACK points immediately before each platform.
// If the minimum in that window is more than THRESHOLD below the platform's
// fitted temperature, it is classified as supercooling.

const SC_LOOKBACK = 12   // how many points to scan before the platform
const SC_THRESHOLD = 1.0 // °C — minimum supercooling degree to report

function detectSupercooling(
  time: number[],
  temp: number[],
  platforms: Platform[]
): SupercoolingEvent[] {
  const events: SupercoolingEvent[] = []

  for (let pi = 0; pi < platforms.length; pi++) {
    const p = platforms[pi]
    const winStart = Math.max(0, p.startIndex - SC_LOOKBACK)
    const winEnd = p.startIndex  // exclusive

    if (winEnd <= winStart) continue

    let minIdx = winStart
    for (let i = winStart + 1; i < winEnd; i++) {
      if (temp[i] < temp[minIdx]) minIdx = i
    }

    const degree = p.fittedTemp - temp[minIdx]
    if (degree >= SC_THRESHOLD) {
      events.push({
        platformIndex: pi,
        platformTemp: p.fittedTemp,
        minTemp: temp[minIdx],
        minTime: time[minIdx],
        minIndex: minIdx,
        degree,
      })
    }
  }

  return events
}

export function analyzeCurve(
  time: number[],
  temp: number[],
  platforms: Platform[]
): CurveAnalysis {
  const n = temp.length
  const totalDuration = n > 1 ? time[n - 1] - time[0] : 0
  const totalDrop = n > 1 ? temp[0] - temp[n - 1] : 0

  const rates = computeCoolingRates(time, temp)
  const avgCoolingRate = rates.length > 0 ? (mean(rates) as number) : 0
  const maxCoolingRate = rates.length > 0 ? (max(rates) as number) : 0

  const reboundDetails: string[] = []
  let reboundStart: number | null = null
  let reboundAccum = 0

  for (let i = 1; i < n; i++) {
    const delta = temp[i] - temp[i - 1]
    if (delta > 0) {
      if (reboundStart === null) reboundStart = i - 1
      reboundAccum += delta
    } else {
      if (reboundStart !== null && reboundAccum >= 2) {
        reboundDetails.push(
          `${time[reboundStart]}s–${time[i - 1]}s 回升约 ${reboundAccum.toFixed(1)}°C`
        )
      }
      reboundStart = null
      reboundAccum = 0
    }
  }
  if (reboundStart !== null && reboundAccum >= 2) {
    reboundDetails.push(
      `${time[reboundStart]}s–${time[n - 1]}s 回升约 ${reboundAccum.toFixed(1)}°C`
    )
  }

  const supercooling = detectSupercooling(time, temp, platforms)

  return {
    totalDuration,
    totalDrop,
    avgCoolingRate,
    maxCoolingRate,
    platformCount: platforms.length,
    platforms,
    supercooling,
    hasRebound: reboundDetails.length > 0,
    reboundDetails,
    hasFastCooling: avgCoolingRate > 1,
    hasSlowCooling: avgCoolingRate < 0.05,
    noVisiblePlatform: platforms.length === 0,
  }
}
