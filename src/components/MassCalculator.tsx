import { useState, useMemo } from "react"

const X_LA = [0, 0.05, 0.10, 0.20, 0.35, 0.50, 0.70, 1.00]
const M_LA = 200.32       // 月桂酸 mol mass g/mol
const M_MENTHOL = 156.27  // 薄荷醇 mol mass g/mol (L 和 DL 相同)

type MentholType = "L" | "DL"

interface Row {
  index: number
  xLA: number
  mMenthol: number
  mLA: number
  mTotal: number
}

function calcRows(totalMass: number): Row[] {
  return X_LA.map((xLA, i) => {
    const denom = xLA * M_LA + (1 - xLA) * M_MENTHOL
    const nTotal = totalMass / denom
    const mLA = nTotal * xLA * M_LA
    const mMenthol = nTotal * (1 - xLA) * M_MENTHOL
    return { index: i + 1, xLA, mMenthol, mLA, mTotal: mLA + mMenthol }
  })
}

export default function MassCalculator() {
  const [mentholType, setMentholType] = useState<MentholType>("L")
  const [massInput, setMassInput] = useState("")
  const [copied, setCopied] = useState(false)

  const totalMass = parseFloat(massInput)
  const isValid = !isNaN(totalMass) && totalMass > 0
  const rows = useMemo(() => (isValid ? calcRows(totalMass) : []), [totalMass, isValid])

  function handleCopy() {
    if (!isValid) return
    const header = `配方质量计算（${mentholType}-薄荷醇，目标总量 ${totalMass} g）\n编号\txLA\tm(薄荷醇)/g\tm(月桂酸)/g\tm(总计)/g`
    const body = rows
      .map(
        (r) =>
          `${r.index}\t${r.xLA.toFixed(2)}\t${r.mMenthol.toFixed(4)}\t${r.mLA.toFixed(4)}\t${r.mTotal.toFixed(4)}`
      )
      .join("\n")
    navigator.clipboard.writeText(header + "\n" + body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">⚗️ 配方质量计算器</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            薄荷醇–月桂酸二元体系 · 8 组 x<sub>LA</sub> 配方
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
          月桂酸 M = {M_LA} g/mol
        </span>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap gap-3">
        {/* Menthol type selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">薄荷醇类型</label>
          <select
            value={mentholType}
            onChange={(e) => setMentholType(e.target.value as MentholType)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30"
          >
            <option value="L">L-薄荷醇（156.27 g/mol）</option>
            <option value="DL">DL-薄荷醇（156.27 g/mol）</option>
          </select>
        </div>

        {/* Total mass input */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">目标总质量（g）</label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            placeholder="输入总质量，如 3"
            value={massInput}
            onChange={(e) => setMassInput(e.target.value)}
            className="h-9 w-44 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30"
          />
        </div>
      </div>

      {/* Table */}
      {isValid ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2 pl-3 pr-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">
                    x<sub>LA</sub>
                    <span className="ml-1 font-normal text-slate-400">摩尔分数</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    m({mentholType}-薄荷醇)
                    <span className="ml-1 font-normal text-slate-400">g</span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    m(月桂酸)
                    <span className="ml-1 font-normal text-slate-400">g</span>
                  </th>
                  <th className="py-2 pl-3 pr-4 text-right font-medium">
                    m(总计)
                    <span className="ml-1 font-normal text-slate-400">g</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isPureMenthol = row.xLA === 0
                  const isPureLA = row.xLA === 1.0
                  return (
                    <tr
                      key={row.index}
                      className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-2 pl-3 pr-2 text-slate-400">{row.index}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-700">
                          {row.xLA.toFixed(2)}
                        </span>
                        {isPureMenthol && (
                          <span className="ml-2 rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            纯薄荷醇
                          </span>
                        )}
                        {isPureLA && (
                          <span className="ml-2 rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            纯月桂酸
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">
                        {isPureMenthol ? (
                          <strong>{row.mMenthol.toFixed(4)}</strong>
                        ) : isPureLA ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          row.mMenthol.toFixed(4)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">
                        {isPureLA ? (
                          <strong>{row.mLA.toFixed(4)}</strong>
                        ) : isPureMenthol ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          row.mLA.toFixed(4)
                        )}
                      </td>
                      <td className="py-2 pl-3 pr-4 text-right font-mono text-slate-400">
                        {row.mTotal.toFixed(4)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Copy button */}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              {copied ? "✓ 已复制" : "📋 复制数据（可粘贴到Excel）"}
            </button>
            <span className="text-xs text-slate-400">
              薄荷醇 M = {M_MENTHOL} g/mol
            </span>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">请输入目标总质量，自动计算 8 组配方 👆</p>
        </div>
      )}
    </div>
  )
}
