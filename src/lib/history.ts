import type { GroupData } from "./types"

export interface HistoryEntry {
  id: string
  savedAt: number
  intervalSecs: number
  groupCount: number
  groups: GroupData[]
  analysisTexts: Record<number, string>
}

const KEY = "cca_history"
const MAX = 3

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export function saveToHistory(entry: Omit<HistoryEntry, "id" | "savedAt">): string {
  const id = crypto.randomUUID()
  try {
    const existing = loadHistory()
    const newEntry: HistoryEntry = { ...entry, id, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify([newEntry, ...existing].slice(0, MAX)))
  } catch {
    // quota exceeded or unavailable
  }
  return id
}

export function updateHistoryEntry(id: string, patch: Partial<HistoryEntry>): void {
  try {
    const entries = loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e))
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {}
}

export function deleteHistoryEntry(id: string): void {
  try {
    const entries = loadHistory().filter((e) => e.id !== id)
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {}
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return "昨天"
  if (days < 7) return `${days} 天前`
  return new Date(ts).toLocaleDateString("zh-CN")
}
