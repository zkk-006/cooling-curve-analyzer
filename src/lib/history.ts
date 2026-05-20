import { type GroupData } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string
  intervalSecs: number
  groupCount: number
  groups: GroupData[]
  analysisTexts: Record<number, string>
  imageDataUrl?: string   // ← NEW: chart screenshot (base64)
  savedAt: number
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "cooling_curve_history"
const MAX_ENTRIES = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function readAll(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

function writeAll(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full — drop oldest entry and retry
    const trimmed = entries.slice(1)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // ignore
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function loadHistory(): HistoryEntry[] {
  return readAll().slice(0, MAX_ENTRIES)
}

export function saveToHistory(data: {
  intervalSecs: number
  groupCount: number
  groups: GroupData[]
  analysisTexts: Record<number, string>
  imageDataUrl?: string
}): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const entry: HistoryEntry = {
    id,
    intervalSecs: data.intervalSecs,
    groupCount: data.groupCount,
    groups: data.groups,
    analysisTexts: data.analysisTexts,
    imageDataUrl: data.imageDataUrl,
    savedAt: Date.now(),
  }

  const all = readAll()
  // Prepend (newest first), cap at MAX_ENTRIES
  writeAll([entry, ...all].slice(0, MAX_ENTRIES))
  return id
}

export function updateHistoryEntry(
  id: string,
  patch: Partial<Pick<HistoryEntry, "analysisTexts" | "imageDataUrl">>
) {
  const all = readAll()
  const idx = all.findIndex((e) => e.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], ...patch }
  writeAll(all)
}

export function deleteHistoryEntry(id: string) {
  writeAll(readAll().filter((e) => e.id !== id))
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
