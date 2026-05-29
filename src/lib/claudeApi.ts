import type { CurveAnalysis } from "./curveFitting"

const API_KEY = "sk-87986c27a9aa4b46ac4638fc1f96efeb"

const SYSTEM_PROMPT =
  "你是一位材料科学、物理化学和热分析领域的专家教授，擅长分析步冷曲线实验数据并给出实验改进建议。"

function buildUserPrompt(analysis: CurveAnalysis): string {
  const platformDetail =
    analysis.platforms
      .map(
        (p) =>
          `时间 ${p.startTime}-${p.endTime}s，拟合相变温度 ${p.fittedTemp.toFixed(2)}°C，` +
          `平台斜率 ${p.slope.toFixed(4)}°C/s，拟合优度 R²=${p.r2.toFixed(3)}，持续 ${p.duration}s`
      )
      .join("；") || "未检测到"

  return `以下是一次步冷曲线实验的数据分析结果，请进行专业诊断：

【基本参数】
- 实验总时长：${analysis.totalDuration} 秒
- 总降温幅度：${analysis.totalDrop.toFixed(1)}°C
- 平均冷却速率：${analysis.avgCoolingRate.toFixed(3)}°C/s
- 最大瞬时冷却速率：${analysis.maxCoolingRate.toFixed(3)}°C/s

【相变平台】
- 检测到平台数：${analysis.platformCount} 个
- 平台详情：${platformDetail}

【过冷现象】
${
  analysis.supercooling.length > 0
    ? analysis.supercooling
        .map(
          (s) =>
            `- 平台 ${s.platformIndex + 1} 前检测到过冷：最低温度 ${s.minTemp.toFixed(2)}°C（时间 ${s.minTime}s），` +
            `过冷度 ${s.degree.toFixed(2)}°C，平台相变温度 ${s.platformTemp.toFixed(2)}°C`
        )
        .join("\n")
    : "- 未检测到明显过冷现象"
}

【异常情况】
- 温度回升：${analysis.hasRebound ? "是，" + analysis.reboundDetails.join("；") : "无"}
- 冷却速率异常偏快：${analysis.hasFastCooling ? "是" : "否"}
- 冷却速率异常偏慢：${analysis.hasSlowCooling ? "是" : "否"}
- 平台不明显或缺失：${analysis.noVisiblePlatform ? "是" : "否"}

请按以下结构回答：

## 一、曲线综合评价
（整体评价这条步冷曲线的质量和反映的相变过程）

## 二、存在的问题
（逐条列出，每条用"【问题N】"开头）

## 三、原因分析
（对应每个问题分析实验原因）

## 四、改进建议
（具体可操作的改进方案，逐条列出）

## 五、推测与补充
（根据平台温度推测可能的物质体系，或进一步实验建议）`
}

export async function* analyzeCoolingCurve(
  analysis: CurveAnalysis
): AsyncGenerator<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 2000,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(analysis) }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API 请求失败 (${response.status}): ${errText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue

      const jsonStr = trimmed.slice(5).trim()
      if (jsonStr === "[DONE]") return

      try {
        const event = JSON.parse(jsonStr)
        const text: string | undefined =
          event?.choices?.[0]?.delta?.content
        if (text) yield text
      } catch {
        // malformed chunk, skip
      }
    }
  }
}
