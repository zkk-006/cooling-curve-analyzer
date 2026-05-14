import { useMemo } from "react"
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Brush,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { type GroupData, groupColor } from "@/lib/types"

interface CurveChartProps {
  groups: GroupData[]
}

// ── Merged dataset for shared XAxis ──────────────────────────────────────────

function buildMergedData(groups: GroupData[]) {
  const timeSet = new Set<number>()
  groups.forEach((g) => g.rawData.time.forEach((t) => timeSet.add(t)))
  const times = Array.from(timeSet).sort((a, b) => a - b)
  return times.map((t) => {
    const row: Record<string, number | null> = { time: t }
    groups.forEach((g, gi) => {
      const idx = g.rawData.time.indexOf(t)
      row[`s${gi}`] = idx >= 0 ? (g.smoothed[idx] ?? null) : null
    })
    return row
  })
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  groups,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | null; color: string; payload: Record<string, number | null> }>
  groups: GroupData[]
}) {
  if (!active || !payload?.length) return null
  const time = payload[0]?.payload?.time
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 text-xs text-muted-foreground">⏱ 时间：{time} s</p>
      {groups.map((g, gi) => {
        const entry = payload.find((p) => p.dataKey === `s${gi}`)
        if (!entry || entry.value == null) return null
        return (
          <p key={gi} style={{ color: groupColor(gi) }} className="font-medium">
            🌡 {g.label}：{Number(entry.value).toFixed(2)} °C
          </p>
        )
      })}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs"
      style={
        color
          ? { borderColor: color + "60", background: color + "12", color }
          : undefined
      }
    >
      {children}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CurveChart({ groups }: CurveChartProps) {
  const mergedData = useMemo(() => buildMergedData(groups), [groups])

  const allTemps = groups.flatMap((g) => g.rawData.temperature)
  const yMin = allTemps.length ? Math.min(...allTemps) - 5 : 0
  const yMax = allTemps.length ? Math.max(...allTemps) + 5 : 100

  const multiGroup = groups.length > 1

  // Tooltip content as closure to capture groups
  const tooltipContent = useMemo(
    () =>
      (props: Parameters<typeof CustomTooltip>[0]) =>
        <CustomTooltip {...props} groups={groups} />,
    [groups]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-1">
        <h2 className="text-base font-semibold sm:text-lg">
          步冷曲线{multiGroup ? `（${groups.length} 组对比）` : ""}
        </h2>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {groups.map((g, i) => (
            <span key={i} style={{ color: groupColor(i) }} className="ml-3">
              {g.label} {g.rawData.time.length} 点
            </span>
          ))}
        </span>
      </div>

      {/* Chart */}
      <div className="h-[260px] sm:h-[360px] lg:h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={mergedData}
          margin={{ top: 12, right: 12, left: 0, bottom: 32 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            label={{ value: "时间 (s)", position: "insideBottom", offset: -24 }}
            tick={{ fontSize: 12 }}
          />

          <YAxis
            domain={[yMin, yMax]}
            label={{ value: "温度 (°C)", angle: -90, position: "insideLeft", offset: 14 }}
            tick={{ fontSize: 11 }}
            width={52}
          />

          <Tooltip content={tooltipContent} />

          {multiGroup && (
            <Legend
              verticalAlign="top"
              formatter={(value) => value}
              wrapperStyle={{ paddingBottom: 8 }}
            />
          )}

          {/* Platform highlight areas — per group */}
          {groups.flatMap((g, gi) =>
            g.platforms.map((p, pi) => (
              <ReferenceArea
                key={`area-${gi}-${pi}`}
                x1={p.startTime}
                x2={p.endTime}
                fill={groupColor(gi) + "22"}
                stroke={groupColor(gi) + "60"}
                strokeWidth={1}
              />
            ))
          )}

          {/* Platform labels — per group (offset vertically for multi-group) */}
          {groups.flatMap((g, gi) =>
            g.platforms.map((p, pi) => (
              <ReferenceLine
                key={`plabel-${gi}-${pi}`}
                x={Math.round((p.startTime + p.endTime) / 2)}
                stroke="transparent"
                label={{
                  value: `${multiGroup ? g.label + " · " : ""}平台 ${pi + 1} · ${p.fittedTemp.toFixed(1)}°C`,
                  position: "top",
                  fontSize: 10,
                  fill: groupColor(gi),
                  fontWeight: 600,
                }}
              />
            ))
          )}

          {/* Supercooling markers — per group */}
          {groups.flatMap((g, gi) =>
            g.supercooling.map((s, si) => (
              <ReferenceLine
                key={`sc-${gi}-${si}`}
                x={s.minTime}
                stroke={groupColor(gi) + "80"}
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{
                  value: `过冷 ${s.degree.toFixed(1)}°C`,
                  position: "insideBottomRight",
                  fontSize: 9,
                  fill: groupColor(gi),
                }}
              />
            ))
          )}

          {/* Raw data scatter — per group */}
          {groups.map((g, gi) => (
            <Scatter
              key={`scatter-${gi}`}
              data={g.rawData.time.map((t, i) => ({
                x: t,
                y: g.rawData.temperature[i],
              }))}
              fill={groupColor(gi) + "40"}
              line={false}
              name={`${g.label} 原始`}
            />
          ))}

          {/* Anomaly markers — per group */}
          {groups.flatMap((g, gi) =>
            g.anomalies.length > 0 ? (
              <Scatter
                key={`anomaly-${gi}`}
                data={g.anomalies.map((a) => ({ x: a.time, y: a.temperature }))}
                fill="hsl(25 95% 53%)"
                line={false}
                name={`${g.label} 异常`}
                shape={(props: { cx: number; cy: number }) => {
                  const { cx, cy } = props
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={7} fill="hsl(25 95% 53% / 0.2)" stroke="hsl(25 95% 53%)" strokeWidth={2} />
                      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="bold" fill="hsl(25 95% 40%)">!</text>
                    </g>
                  )
                }}
              />
            ) : []
          )}

          {/* Smoothed lines — one per group */}
          {groups.map((g, gi) => (
            <Line
              key={`line-${gi}`}
              dataKey={`s${gi}`}
              stroke={groupColor(gi)}
              strokeWidth={2}
              dot={false}
              name={g.label}
              connectNulls={false}
              activeDot={{
                r: 6,
                stroke: "white",
                strokeWidth: 2,
                fill: groupColor(gi),
              }}
            />
          ))}

          <Brush
            dataKey="time"
            height={24}
            stroke="hsl(var(--border))"
            fill="hsl(var(--muted))"
            travellerWidth={6}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* Platform badges — per group */}
      {groups.some((g) => g.platforms.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {groups.flatMap((g, gi) =>
            g.platforms.map((p, pi) => (
              <Badge key={`${gi}-${pi}`} color={groupColor(gi)}>
                {multiGroup ? `${g.label} · ` : ""}平台 {pi + 1}：
                {p.startTime}–{p.endTime}s · {p.fittedTemp.toFixed(1)}°C · 持续 {p.duration}s · R²=
                {p.r2.toFixed(3)}
              </Badge>
            ))
          )}
        </div>
      )}

      {/* Supercooling badges */}
      {groups.some((g) => g.supercooling.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {groups.flatMap((g, gi) =>
            g.supercooling.map((s, si) => (
              <span
                key={`${gi}-${si}`}
                className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
              >
                {multiGroup ? `${g.label} · ` : ""}过冷现象：最低 {s.minTemp.toFixed(1)}°C，
                过冷度 {s.degree.toFixed(1)}°C
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}
