import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { analyzeCoolingCurve } from "@/lib/claudeApi"
import type { CurveAnalysis } from "@/lib/curveFitting"

interface AnalysisPanelProps {
  analysis: CurveAnalysis | null
  label?: string
  onTextReady?: (text: string) => void
  initialText?: string  // pre-loaded text from history — skips API call
}

type Status = "idle" | "loading" | "done" | "error"

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined

export default function AnalysisPanel({ analysis, label, onTextReady, initialText }: AnalysisPanelProps) {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const abortRef = useRef<boolean>(false)

  useEffect(() => {
    if (!analysis) return

    // If pre-loaded text is supplied (e.g. restored from history), skip the API call
    if (initialText) {
      setText(initialText)
      setStatus("done")
      return
    }

    abortRef.current = false
    setText("")
    setErrorMsg("")
    setStatus("loading")

    async function run() {
      let accumulated = ""
      try {
        for await (const chunk of analyzeCoolingCurve(analysis!)) {
          if (abortRef.current) break
          accumulated += chunk
          setText((prev) => prev + chunk)
        }
        if (!abortRef.current) {
          setStatus("done")
          onTextReady?.(accumulated)
        }
      } catch (err) {
        if (!abortRef.current) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setStatus("error")
        }
      }
    }

    run()

    return () => {
      abortRef.current = true
    }
  }, [analysis])

  if (!analysis) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          🤖 {label ? `${label} · ` : ""}AI 智能分析
        </h2>
        <StatusBadge status={status} />
      </div>

      {/* Missing API key warning */}
      {!API_KEY && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
          ⚠ 未配置 API Key，请在 .env 文件中添加 VITE_ANTHROPIC_API_KEY 并重启开发服务器
        </div>
      )}

      {/* Network error */}
      {status === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Result card */}
      {text && (
        <div className="relative rounded-xl border border-blue-200 bg-blue-50/60 px-6 py-5 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>

          {status === "done" && (
            <div className="mt-4 flex justify-end">
              <CopyButton text={text} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  if (status === "idle") return null

  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
        <Spinner />
        分析中...
      </span>
    )
  }

  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ 分析完成
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
      ✕ 分析失败
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="size-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? "✓ 已复制" : "复制全文"}
    </button>
  )
}
