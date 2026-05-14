import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { detectAnomalies, type AnomalyPoint } from "@/lib/curveFitting"

interface StepTwoProps {
  interval: number
  groupIndex: number   // 0-based
  groupCount: number
  onConfirm: (data: { time: number[]; temperature: number[] }) => void
  onBack: () => void
}

type TempUnit = "°C" | "K"

type ParseStatus =
  | { type: "idle" }
  | { type: "parsing" }
  | { type: "ok"; count: number; span: number }
  | { type: "error" }

interface ParsedData {
  time: number[]
  temperature: number[]
}

const PREVIEW_ROWS = 8

function parseTemperatures(raw: string): number[] {
  return raw
    .split(/[\n\r\s,\t]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "" && !isNaN(Number(s)))
    .map(Number)
}

function toCelsius(temps: number[], unit: TempUnit): number[] {
  return unit === "K" ? temps.map((t) => t - 273.15) : temps
}

export default function StepTwo({
  interval,
  groupIndex,
  groupCount,
  onConfirm,
  onBack,
}: StepTwoProps) {
  const [text, setText] = useState("")
  const [tempUnit, setTempUnit] = useState<TempUnit>("°C")
  const [status, setStatus] = useState<ParseStatus>({ type: "idle" })
  const [preview, setPreview] = useState<ParsedData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyPoint[]>([])
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleParse = useCallback(
    (raw: string, unit: TempUnit) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (raw.trim() === "") {
        setStatus({ type: "idle" })
        setPreview(null)
        setAnomalies([])
        return
      }
      setStatus({ type: "parsing" })
      timerRef.current = setTimeout(() => {
        const rawTemps = parseTemperatures(raw)
        if (rawTemps.length === 0) {
          setStatus({ type: "error" })
          setPreview(null)
          setAnomalies([])
          return
        }
        const temps = toCelsius(rawTemps, unit)
        const time = temps.map((_, i) => i * interval)
        setStatus({ type: "ok", count: temps.length, span: (temps.length - 1) * interval })
        setPreview({ time, temperature: temps })
        setAnomalies(detectAnomalies(time, temps))
        setExpanded(false)
      }, 300)
    },
    [interval]
  )

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value
    setText(raw)
    scheduleParse(raw, tempUnit)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.getData("text").trim()) setStatus({ type: "parsing" })
  }

  function handleUnitChange(u: TempUnit) {
    setTempUnit(u)
    if (text.trim()) scheduleParse(text, u)
  }

  function handleConfirm() {
    if (preview) onConfirm(preview)
  }

  const intervalDisplay =
    interval >= 60 && interval % 60 === 0
      ? `${interval / 60} min`
      : `${interval} s`

  const groupLabel =
    groupCount > 1
      ? `第 ${groupIndex + 1} 组 / 共 ${groupCount} 组`
      : null

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-4 py-6 sm:justify-center sm:py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-xl">
                第 2 步 · 粘贴温度数据
                {groupLabel && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({groupLabel})
                  </span>
                )}
              </CardTitle>
              {groupCount > 1 && (
                <GroupDots total={groupCount} current={groupIndex} />
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                时间间隔：{intervalDisplay}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">温度单位</span>
                <UnitToggle options={["°C", "K"]} value={tempUnit} onChange={handleUnitChange} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {tempUnit === "K" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              已选择开尔文（K），数据将自动换算为 °C（减去 273.15）再进行分析
            </div>
          )}

          <textarea
            value={text}
            onChange={handleChange}
            onPaste={handlePaste}
            placeholder={`直接将温度数据粘贴到这里，支持以下格式：\n• 每行一个数值（换行分隔）\n• 空格或逗号分隔\n• 从 Excel 直接复制粘贴均可\n例如：${tempUnit === "K" ? "623 593 568 551 538 ..." : "350 320 295 278 265 ..."}`}
            className={[
              "w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm leading-relaxed",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "transition-colors",
              status.type === "error"
                ? "border-destructive ring-3 ring-destructive/20"
                : "border-input",
            ].join(" ")}
            style={{ height: 200 }}
          />

          <StatusLine status={status} unit={tempUnit} />

          {preview && status.type === "ok" && (
            <DataPreview
              data={preview}
              unit={tempUnit}
              anomalyIndices={new Set(anomalies.map((a) => a.index))}
              expanded={expanded}
              onToggleExpand={() => setExpanded((v) => !v)}
            />
          )}

          {anomalies.length > 0 && <AnomalyWarnings anomalies={anomalies} />}

          {/* Confirm button */}
          {status.type === "ok" && preview && (
            <Button size="lg" className="w-full" onClick={handleConfirm}>
              {groupCount > 1
                ? groupIndex < groupCount - 1
                  ? `确认第 ${groupIndex + 1} 组，查看曲线 →`
                  : `确认最后一组，查看全部对比 →`
                : "查看曲线 →"}
            </Button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
          >
            ← 重新设置实验参数
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Group progress dots ───────────────────────────────────────────────────────

function GroupDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            "h-1.5 rounded-full transition-all",
            i < current
              ? "w-4 bg-primary/40"
              : i === current
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/30",
          ].join(" ")}
        />
      ))}
    </div>
  )
}

// ── Status Line ───────────────────────────────────────────────────────────────

function StatusLine({ status, unit }: { status: ParseStatus; unit: TempUnit }) {
  if (status.type === "idle") return null
  if (status.type === "parsing") return <p className="text-sm text-muted-foreground">解析中...</p>
  if (status.type === "ok") {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        ✓ 已识别 {status.count} 个数据点，时间跨度 {status.span} 秒
        {unit === "K" && "（已换算为 °C）"}
      </p>
    )
  }
  return <p className="text-sm text-destructive">⚠ 未识别到有效数据，请检查格式</p>
}

// ── Data Preview ──────────────────────────────────────────────────────────────

function DataPreview({
  data,
  unit,
  anomalyIndices,
  expanded,
  onToggleExpand,
}: {
  data: { time: number[]; temperature: number[] }
  unit: TempUnit
  anomalyIndices: Set<number>
  expanded: boolean
  onToggleExpand: () => void
}) {
  const total = data.time.length
  const rows = expanded ? data.time : data.time.slice(0, PREVIEW_ROWS)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">数据预览（共 {total} 条）</span>
        <span className="text-xs text-muted-foreground">
          {unit === "K" ? "温度已换算为 °C" : "温度单位：°C"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:px-4">序号</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:px-4">时间 (s)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:px-4">
                温度 {unit === "K" ? "(K→°C)" : "(°C)"}
              </th>
              <th className="hidden px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:table-cell sm:px-4">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const isAnomaly = anomalyIndices.has(i)
              return (
                <tr
                  key={i}
                  className={
                    isAnomaly
                      ? "bg-orange-50 dark:bg-orange-950/30"
                      : i % 2 === 0
                        ? "bg-background"
                        : "bg-muted/20"
                  }
                >
                  <td className="px-3 py-1.5 text-xs text-muted-foreground sm:px-4">{i + 1}</td>
                  <td className="px-3 py-1.5 text-xs font-mono sm:px-4">{t}</td>
                  <td className={["px-3 py-1.5 text-xs font-mono font-medium sm:px-4", isAnomaly ? "text-orange-600 dark:text-orange-400" : ""].join(" ")}>
                    {data.temperature[i].toFixed(2)}
                    {isAnomaly && <span className="ml-1 sm:hidden">⚠</span>}
                  </td>
                  <td className="hidden px-3 py-1.5 text-xs sm:table-cell sm:px-4">
                    {isAnomaly && <span className="font-medium text-orange-500">⚠ 异常</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {total > PREVIEW_ROWS && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full border-t border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {expanded ? "▲ 收起" : `▼ 展开全部 ${total} 条数据`}
        </button>
      )}
    </div>
  )
}

// ── Anomaly Warnings ──────────────────────────────────────────────────────────

function AnomalyWarnings({ anomalies }: { anomalies: AnomalyPoint[] }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950/30">
      <p className="mb-2 text-sm font-medium text-orange-700 dark:text-orange-400">
        ⚠ 检测到 {anomalies.length} 个异常数据点，请检查是否记录有误
      </p>
      <ul className="flex flex-col gap-1">
        {anomalies.map((a) => (
          <li key={a.index} className="text-xs text-orange-600 dark:text-orange-400">
            第 {a.index + 1} 个数据点（时间 {a.time}s）：温度突变{" "}
            {a.delta > 0 ? "+" : ""}{a.delta.toFixed(1)}°C，当前值 {a.temperature.toFixed(1)}°C
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Unit Toggle ───────────────────────────────────────────────────────────────

function UnitToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={[
            "px-2.5 py-1 text-sm font-medium transition-colors",
            opt === value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          ].join(" ")}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
