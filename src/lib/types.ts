import type {
  Platform,
  CurveAnalysis,
  AnomalyPoint,
  SupercoolingEvent,
} from "./curveFitting"

export interface GroupData {
  label: string
  rawData: { time: number[]; temperature: number[] }
  smoothed: number[]
  platforms: Platform[]
  coolingRates: number[]
  anomalies: AnomalyPoint[]
  supercooling: SupercoolingEvent[]
  analysis: CurveAnalysis
}

export const GROUP_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#a855f7", // purple
  "#f59e0b", // amber
]

export function groupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]
}
