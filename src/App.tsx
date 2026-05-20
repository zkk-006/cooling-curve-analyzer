import { useState, useRef, useEffect, useCallback } from "react"
import MassCalculator from "@/components/MassCalculator"
import StepOne from "@/components/StepOne"
import StepTwo from "@/components/StepTwo"
import CurveChart from "@/components/CurveChart"
import AnalysisPanel from "@/components/AnalysisPanel"
import {
  smoothData,
  detectPlatforms,
  computeCoolingRates,
  analyzeCurve,
  detectAnomalies,
} from "@/lib/curveFitting"
import { type GroupData, groupColor } from "@/lib/types"
import { exportReport } from "@/lib/exportReport"
import {
  loadHistory,
  saveToHistory,
  updateHistoryEntry,
  deleteHistoryEntry,
  formatRelativeTime,
  type HistoryEntry,
} from "@/lib/history"

type Step = "interval" | "input" | "result"

async function captureChartImage(el: HTMLElement | null): Promise<string | undefined> {
  if (!el) return undefined
  try {
    const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(el, { scale: 1, useCORS: true, logging: false, backgroundColor: "#ffffff" })
    return canvas.toDataURL("image/jpeg", 0.7)
  } catch {
    return undefined
  }
}

export default function App() {
  const [step, setStep] = useState<Step>("interval")
  const [intervalSecs, setIntervalSecs] = useState(30)
  const [groupCount, setGroupCount] = useState(1)
  const [groups, setGroups] = useState<GroupData[]>([])
  const [expandedAnalysis, setExpandedAnalysis] = useState<number>(0)
  const [analysisTexts, setAnalysisTexts] = useState<Record<number, string>>({})
  const [exporting, setExporting] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [historyOpen, setHistoryOpen] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const historyIdRef = useRef<string | null>(null)
  const isSampleRef = useRef(false)

  const currentGroupIndex = groups.length
  const allDoneEarly = groups.length >= groupCount && groups.length > 0

  const saveWithImage = useCallback(async () => {
    if (!allDoneEarly || step !== "result" || isSampleRef.current) return
    await new Promise((r) => setTimeout(r, 300))
    const imageDataUrl = await captureChartImage(chartRef.current)
    if (!historyIdRef.current) {
      historyIdRef.current = saveToHistory({ intervalSecs, groupCount, groups, analysisTexts, imageDataUrl })
    } else {
      updateHistoryEntry(historyIdRef.current, { analysisTexts, imageDataUrl })
    }
    setHistory(loadHistory())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDoneEarly, step, analysisTexts, intervalSecs, groupCount, groups])

  useEffect(() => { saveWithImage() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [allDoneEarly, step, analysisTexts])

  function handleIntervalConfirm(seconds: number, count: number) {
    setIntervalSecs(seconds); setGroupCount(count); setGroups([])
    setExpandedAnalysis(0); setAnalysisTexts({})
    historyIdRef.current = null; isSampleRef.current = false
    setStep("input")
  }

  function handleGroupConfirm(rawData: { time: number[]; temperature: number[] }) {
    const s = smoothData(rawData.temperature)
    const p = detectPlatforms(rawData.time, rawData.temperature)
    const r = computeCoolingRates(rawData.time, rawData.temperature)
    const a = analyzeCurve(rawData.time, rawData.temperature, p)
    const an = detectAnomalies(rawData.time, rawData.temperature)
    setGroups((prev) => {
      const label = `第 ${prev.length + 1} 组`
      return [...prev, { label, rawData, smoothed: s, platforms: p, coolingRates: r, anomalies: an, supercooling: a.supercooling, analysis: a }]
    })
    setStep("result")
  }

  function handleReset() {
    setStep("interval"); setGroups([]); setExpandedAnalysis(0); setAnalysisTexts({})
    historyIdRef.current = null; isSampleRef.current = false
  }

  function handleAnalysisReady(groupIndex: number, text: string) {
    setAnalysisTexts((prev) => ({ ...prev, [groupIndex]: text }))
  }

  function handleLoadSample() {
    const INTERVAL = 30
    const samples = [
      { label: "第 1 组", temps: [105,101,97,93,89,85,81,77.5,79.9,80.4,80.4,80.3,80.2,80.0,79.8,78,74,70,66,62,58,54,51,48,45] },
      { label: "第 2 组", temps: [105,100,96,92,88,84,80,76,73,71.3,71.5,71.5,71.4,71.3,71.1,70.9,69,66,63,60,57,54,51,48,45] },
    ]
    const built: GroupData[] = samples.map(({ label, temps }) => {
      const time = temps.map((_, i) => i * INTERVAL)
      const rawData = { time, temperature: temps }
      const s = smoothData(temps); const p = detectPlatforms(time, temps)
      const r = computeCoolingRates(time, temps); const a = analyzeCurve(time, temps, p)
      const an = detectAnomalies(time, temps)
      return { label, rawData, smoothed: s, platforms: p, coolingRates: r, anomalies: an, supercooling: a.supercooling, analysis: a }
    })
    setIntervalSecs(INTERVAL); setGroupCount(2); setGroups(built)
    setAnalysisTexts({}); setExpandedAnalysis(0)
    historyIdRef.current = null; isSampleRef.current = true
    setStep("result")
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    setIntervalSecs(entry.intervalSecs); setGroupCount(entry.groupCount)
    setGroups(entry.groups); setAnalysisTexts(entry.analysisTexts)
    setExpandedAnalysis(0); historyIdRef.current = entry.id
    isSampleRef.current = false; setHistoryOpen(false); setStep("result")
  }

  function handleDeleteHistory(id: string) {
    deleteHistoryEntry(id); setHistory(loadHistory())
  }

  async function handleExport() {
    setExporting(true)
    try { await exportReport(chartRef.current, groups, analysisTexts, intervalSecs) }
    finally { setExporting(false) }
  }

  const allDone = allDoneEarly
  const intervalDisplay = intervalSecs >= 60 && intervalSecs % 60 === 0 ? `${intervalSecs / 60} min` : `${intervalSecs} s`

  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* ── HOME ─────────────────────────────────────────────────── */}
      {step === "interval" && (
        <div className="relative flex min-h-screen flex-col">

          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
            <div>
              <h1 className="text-lg font-bold text-[#1e40af]">步冷曲线拟合分析系统</h1>
              <p className="text-xs text-slate-400">输入实验数据，自动拟合曲线并 AI 智能诊断</p>
            </div>
            {/* History button */}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-[#1e40af]/40 hover:bg-blue-50 hover:text-[#1e40af]"
            >
              <span className="text-base">＋</span>
              历史记录
              {history.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1e40af] text-[10px] font-bold text-white">
                  {history.length}
                </span>
              )}
            </button>
          </header>

          {/* Two-column main */}
          <main className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-start lg:gap-6 lg:p-6">
            {/* Left: Mass calculator */}
            <div className="w-full lg:flex-1">
              <MassCalculator />
            </div>

            {/* Right: Experiment setup */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-3">
              <StepOne onConfirm={handleIntervalConfirm} />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">或者</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Sample button */}
              <button
                type="button"
                onClick={handleLoadSample}
                className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-[#1e40af]/50 hover:bg-blue-50 hover:text-[#1e40af]"
              >
                🧪 加载示例数据，直接查看效果
                <p className="mt-0.5 text-xs text-slate-400">包含 2 组对照实验，已自动完成分析</p>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ── HISTORY DRAWER ──────────────────────────────────────── */}
      {historyOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">历史实验记录</h2>
                <p className="text-xs text-slate-400">{history.length} 条记录，点击查看</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                  <span className="text-3xl">📋</span>
                  <p className="text-sm">暂无历史记录</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map((entry) => (
                    <HistoryCard
                      key={entry.id}
                      entry={entry}
                      onRestore={handleRestoreHistory}
                      onDelete={handleDeleteHistory}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── INPUT ──────────────────────────────────────────────── */}
      {step === "input" && (
        <div className="flex min-h-screen flex-col">
          <ProgressBar groupCount={groupCount} currentGroupIndex={currentGroupIndex} />
          <div className="flex flex-1 items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl">
              <StepTwo
                key={currentGroupIndex}
                interval={intervalSecs}
                groupIndex={currentGroupIndex}
                groupCount={groupCount}
                onConfirm={handleGroupConfirm}
                onBack={() => setStep(groups.length === 0 ? "interval" : "result")}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ─────────────────────────────────────────────── */}
      {step === "result" && groups.length > 0 && (
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-slate-500">间隔：<span className="font-medium text-slate-700">{intervalDisplay}</span></span>
                <GroupPills groups={groups} total={groupCount} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleExport} disabled={exporting}
                  className="rounded-md border border-[#1e40af] bg-[#1e40af] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1e3a8a] disabled:opacity-60 sm:text-sm">
                  {exporting ? "生成中..." : "导出 PDF"}
                </button>
                <button type="button" onClick={handleReset}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:text-sm">
                  重新开始
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
            <section ref={chartRef} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
              <CurveChart groups={groups} />
            </section>

            {!allDone && (
              <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#1e40af]/40 bg-blue-50/50 py-8">
                <p className="text-sm text-slate-500">已完成 {groups.length} 组 / 共 {groupCount} 组，继续输入下一组数据</p>
                <button type="button" onClick={() => setStep("input")}
                  className="rounded-lg bg-[#1e40af] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3a8a]">
                  输入第 {groups.length + 1} 组数据 →
                </button>
              </section>
            )}

            <section className="pb-12">
              <h2 className="mb-4 text-base font-semibold text-slate-700">
                AI 智能分析
                {allDone && groupCount > 1 && <span className="ml-2 text-sm font-normal text-slate-400">（{groupCount} 组全部完成，可逐组展开查看）</span>}
              </h2>
              <div className="flex flex-col gap-2">
                {groups.map((g, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setExpandedAnalysis(i === expandedAnalysis ? -1 : i)}
                      className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: groupColor(i) }} />
                        <span className="font-medium text-slate-700">{g.label} · AI 智能分析</span>
                        <span className="text-xs text-slate-400">{g.rawData.time.length} 个数据点 · {g.platforms.length > 0 ? `${g.platforms.length} 个平台` : "无平台"}</span>
                      </div>
                      <span className="text-slate-400">{i === expandedAnalysis ? "▲" : "▼"}</span>
                    </button>
                    {i === expandedAnalysis && (
                      <div className="border-t border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
                        <AnalysisPanel analysis={g.analysis} label={g.label}
                          onTextReady={(text) => handleAnalysisReady(i, text)} initialText={analysisTexts[i]} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ groupCount, currentGroupIndex }: { groupCount: number; currentGroupIndex: number }) {
  const steps = groupCount === 1
    ? ["设置参数", "输入数据", "查看结果"]
    : ["设置参数", ...Array.from({ length: groupCount }, (_, i) => `第 ${i + 1} 组数据`), "查看结果"]
  const current = currentGroupIndex + 1
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center overflow-x-auto px-4 py-3 sm:px-6 sm:py-4">
        {steps.map((label, i) => {
          const done = i < current; const active = i === current
          return (
            <div key={i} className="flex shrink-0 flex-1 items-center">
              <div className="flex items-center gap-1">
                <span className={["flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", done || active ? "bg-[#1e40af] text-white" : "border-2 border-slate-300 text-slate-400"].join(" ")}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={["hidden text-xs sm:inline", active ? "font-semibold text-[#1e40af]" : done ? "text-slate-600" : "text-slate-400"].join(" ")}>{label}</span>
              </div>
              {i < steps.length - 1 && <div className={["mx-1 h-px flex-1 sm:mx-2", i < current ? "bg-[#1e40af]" : "bg-slate-200"].join(" ")} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────────

function HistoryCard({ entry, onRestore, onDelete }: { entry: HistoryEntry; onRestore: (e: HistoryEntry) => void; onDelete: (id: string) => void }) {
  const intervalDisplay = entry.intervalSecs >= 60 && entry.intervalSecs % 60 === 0 ? `${entry.intervalSecs / 60} min` : `${entry.intervalSecs} s`
  const aiDone = Object.keys(entry.analysisTexts).length
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {entry.imageDataUrl ? (
        <div className="relative h-28 w-full overflow-hidden bg-slate-50">
          <img src={entry.imageDataUrl} alt="实验曲线预览" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
        </div>
      ) : (
        <div className="flex h-12 items-center justify-center bg-slate-50 text-xs text-slate-300">暂无图像预览</div>
      )}
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-700">{entry.groupCount} 组实验</span>
            <span className="text-xs text-slate-400">间隔 {intervalDisplay}</span>
            {aiDone > 0 && <span className="text-xs font-medium text-emerald-600">✓ AI已分析</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {entry.groups.map((g, gi) => {
              const temps = g.rawData.temperature
              return <span key={gi} className="text-xs" style={{ color: groupColor(gi) }}>{g.label} {Math.max(...temps).toFixed(0)}→{Math.min(...temps).toFixed(0)}°C</span>
            })}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{formatRelativeTime(entry.savedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={() => onRestore(entry)}
            className="rounded-md border border-[#1e40af] px-2.5 py-1 text-xs font-medium text-[#1e40af] transition-colors hover:bg-blue-50">
            查看
          </button>
          <button type="button" onClick={() => onDelete(entry.id)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-red-200 hover:text-red-400">
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Group pills ───────────────────────────────────────────────────────────────

function GroupPills({ groups, total }: { groups: GroupData[]; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < groups.length
        return (
          <span key={i}
            className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", done ? "text-white" : "border border-slate-200 bg-slate-50 text-slate-400"].join(" ")}
            style={done ? { background: groupColor(i) } : undefined}>
            {done ? `第 ${i + 1} 组 ✓` : `第 ${i + 1} 组`}
          </span>
        )
      })}
    </div>
  )
}

