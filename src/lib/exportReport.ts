import html2canvas from "html2canvas"
import type { GroupData } from "./types"

function formatMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h3 style="font-size:13pt;margin:14pt 0 4pt;border-bottom:1px solid #e0e0e0;padding-bottom:3pt;">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:11pt;margin:10pt 0 3pt;">$1</h4>')
    .replace(/【(.+?)】/g, '<strong>【$1】</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin:6pt 0">')
    .replace(/\n/g, "<br>")
}

async function captureChart(chartEl: HTMLElement): Promise<string> {
  const canvas = await html2canvas(chartEl, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
  })
  return canvas.toDataURL("image/png")
}

function buildHtml(
  groups: GroupData[],
  analysisTexts: Record<number, string>,
  intervalSecs: number,
  chartImgSrc: string
): string {
  const date = new Date().toLocaleString("zh-CN")
  const intervalDisplay =
    intervalSecs >= 60 && intervalSecs % 60 === 0
      ? `${intervalSecs / 60} min`
      : `${intervalSecs} s`

  const groupSections = groups
    .map((g, i) => {
      const firstTemp = g.rawData.temperature[0]
      const lastTemp = g.rawData.temperature[g.rawData.temperature.length - 1]
      const totalDrop = (firstTemp - lastTemp).toFixed(1)

      const platformTable =
        g.platforms.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:10pt;margin:6pt 0">
              <thead>
                <tr style="background:#f5f5f5">
                  <th style="border:1px solid #ccc;padding:4pt 8pt">平台</th>
                  <th style="border:1px solid #ccc;padding:4pt 8pt">时间范围 (s)</th>
                  <th style="border:1px solid #ccc;padding:4pt 8pt">拟合温度 (°C)</th>
                  <th style="border:1px solid #ccc;padding:4pt 8pt">持续时间 (s)</th>
                  <th style="border:1px solid #ccc;padding:4pt 8pt">拟合优度 R²</th>
                </tr>
              </thead>
              <tbody>
                ${g.platforms
                  .map(
                    (p, pi) => `
                  <tr>
                    <td style="border:1px solid #ccc;padding:4pt 8pt;text-align:center">平台 ${pi + 1}</td>
                    <td style="border:1px solid #ccc;padding:4pt 8pt;text-align:center">${p.startTime}–${p.endTime}</td>
                    <td style="border:1px solid #ccc;padding:4pt 8pt;text-align:center">${p.fittedTemp.toFixed(2)}</td>
                    <td style="border:1px solid #ccc;padding:4pt 8pt;text-align:center">${p.duration}</td>
                    <td style="border:1px solid #ccc;padding:4pt 8pt;text-align:center">${p.r2.toFixed(3)}</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
          : '<p style="color:#888;font-size:10pt">未检测到相变平台</p>'

      const supercoolingText =
        g.supercooling.length > 0
          ? `<p style="margin:4pt 0;font-size:10pt">
              ${g.supercooling
                .map(
                  (s) =>
                    `平台 ${s.platformIndex + 1} 前检测到过冷现象：` +
                    `最低温度 ${s.minTemp.toFixed(1)}°C（${s.minTime}s），` +
                    `过冷度 ${s.degree.toFixed(1)}°C`
                )
                .join("；")}
            </p>`
          : ""

      const aiText = analysisTexts[i]
        ? `<div style="line-height:1.9;font-size:11pt">
            <p style="margin:6pt 0">${formatMarkdown(analysisTexts[i])}</p>
           </div>`
        : '<p style="color:#888;font-size:10pt">（AI 分析未完成，请先展开对应分析面板等待加载完毕后再导出）</p>'

      return `
        <div style="margin-top:24pt;page-break-inside:avoid">
          <h2 style="font-size:15pt;margin:0 0 10pt;padding-bottom:5pt;border-bottom:2px solid #1e40af;color:#1e40af">
            ${g.label}
          </h2>
          <h3 style="font-size:12pt;margin:10pt 0 4pt">基本参数</h3>
          <table style="width:100%;border-collapse:collapse;font-size:10pt;margin:4pt 0">
            <tr style="background:#f5f5f5">
              <td style="border:1px solid #ccc;padding:4pt 8pt">数据点数</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">${g.rawData.time.length} 个</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">时间跨度</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">${g.rawData.time[g.rawData.time.length - 1]} s</td>
            </tr>
            <tr>
              <td style="border:1px solid #ccc;padding:4pt 8pt">总降温幅度</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">${totalDrop} °C</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">平均冷却速率</td>
              <td style="border:1px solid #ccc;padding:4pt 8pt">${g.analysis.avgCoolingRate.toFixed(3)} °C/s</td>
            </tr>
          </table>

          <h3 style="font-size:12pt;margin:12pt 0 4pt">相变平台分析</h3>
          ${platformTable}
          ${supercoolingText}

          <h3 style="font-size:12pt;margin:12pt 0 4pt">AI 智能分析</h3>
          ${aiText}
        </div>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>步冷曲线实验报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", "SimSun", sans-serif;
      margin: 0; padding: 20mm 22mm;
      color: #1a1a1a; font-size: 12pt; line-height: 1.7;
    }
    @media print {
      body { padding: 10mm 15mm; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div style="text-align:center;margin-bottom:16pt">
    <h1 style="font-size:22pt;margin:0 0 6pt;color:#1e40af">步冷曲线实验报告</h1>
    <p style="color:#666;font-size:10pt;margin:0">
      生成时间：${date}　｜　时间间隔：${intervalDisplay}　｜　实验组数：${groups.length} 组
    </p>
  </div>

  <hr style="border:none;border-top:2px solid #1e40af;margin:0 0 16pt">

  <h2 style="font-size:15pt;margin:0 0 8pt;color:#1e40af">步冷曲线图</h2>
  ${chartImgSrc ? `<img src="${chartImgSrc}" style="width:100%;border:1px solid #e0e0e0;border-radius:6px" />` : "<p>图表不可用</p>"}

  ${groupSections}
</body>
</html>`
}

export async function exportReport(
  chartEl: HTMLElement | null,
  groups: GroupData[],
  analysisTexts: Record<number, string>,
  intervalSecs: number
): Promise<void> {
  const chartImgSrc = chartEl ? await captureChart(chartEl) : ""
  const html = buildHtml(groups, analysisTexts, intervalSecs, chartImgSrc)

  const win = window.open("", "_blank")
  if (!win) {
    alert("请允许浏览器弹出新窗口，然后重试。")
    return
  }
  win.document.write(html)
  win.document.close()
  // Wait for images to load before printing
  win.addEventListener("load", () => {
    setTimeout(() => win.print(), 300)
  })
}
