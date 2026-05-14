import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface StepOneProps {
  onConfirm: (intervalSeconds: number, groupCount: number) => void
}

type TimeUnit = "s" | "min"

export default function StepOne({ onConfirm }: StepOneProps) {
  const [value, setValue] = useState("30")
  const [unit, setUnit] = useState<TimeUnit>("s")
  const [groupCount, setGroupCount] = useState("1")
  const [errors, setErrors] = useState<{ interval?: string; group?: string }>({})

  function handleNext() {
    const n = Number(value)
    const g = Number(groupCount)
    const newErrors: { interval?: string; group?: string } = {}

    if (isNaN(n) || n <= 0 || value.trim() === "") {
      newErrors.interval =
        unit === "s" ? "请输入有效的正整数秒数" : "请输入有效的正数分钟数"
    } else if (unit === "s" && !Number.isInteger(n)) {
      newErrors.interval = "秒数请输入正整数"
    }

    if (!Number.isInteger(g) || g < 1 || g > 5) {
      newErrors.group = "请输入 1–5 之间的整数"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    const seconds = unit === "min" ? Math.round(n * 60) : n
    onConfirm(seconds, g)
  }

  function handleUnitChange(u: TimeUnit) {
    setUnit(u)
    setErrors({})
    const n = Number(value)
    if (!isNaN(n) && n > 0) {
      setValue(
        u === "min"
          ? String(Math.round((n / 60) * 100) / 100)
          : String(Math.round(n * 60))
      )
    }
  }

  const n = Number(value)
  const preview =
    !isNaN(n) && n > 0
      ? unit === "s"
        ? n >= 60
          ? `≈ ${(n / 60).toFixed(1)} min`
          : ""
        : `= ${Math.round(n * 60)} s`
      : ""

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-4 pt-10 sm:justify-center sm:pt-0">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">第 1 步 · 设置实验参数</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Time interval */}
          <div className="flex flex-col gap-2">
            <label htmlFor="interval" className="text-sm font-medium text-foreground">
              每次记录数据的时间间隔
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="interval"
                type="number"
                min={unit === "s" ? 1 : 0.01}
                step={unit === "s" ? 1 : 0.5}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (errors.interval) setErrors((p) => ({ ...p, interval: undefined }))
                }}
                aria-invalid={errors.interval ? true : undefined}
                className="flex-1"
              />
              <UnitToggle options={["s", "min"]} value={unit} onChange={handleUnitChange} />
            </div>
            {preview && <p className="text-xs text-muted-foreground">{preview}</p>}
            {errors.interval && <p className="text-sm text-destructive">{errors.interval}</p>}
          </div>

          {/* Group count */}
          <div className="flex flex-col gap-2">
            <label htmlFor="groups" className="text-sm font-medium text-foreground">
              本次共做几组对照实验
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="groups"
                type="number"
                min={1}
                max={5}
                step={1}
                value={groupCount}
                onChange={(e) => {
                  setGroupCount(e.target.value)
                  if (errors.group) setErrors((p) => ({ ...p, group: undefined }))
                }}
                aria-invalid={errors.group ? true : undefined}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">组（最多 5 组）</span>
            </div>
            {Number(groupCount) > 1 && !errors.group && (
              <p className="text-xs text-muted-foreground">
                输入完第 1 组数据后，可继续输入第 2 组，最终叠加对比
              </p>
            )}
            {errors.group && <p className="text-sm text-destructive">{errors.group}</p>}
          </div>

          <Button size="lg" className="w-full" onClick={handleNext}>
            下一步 →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

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
