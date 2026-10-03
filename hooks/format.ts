import type { Context, Lang, Limit, Reading } from '../types'

const TEXT = {
  en: {
    session: 'Session',
    weekly: 'Weekly',
    spend: 'Spend',
    context: 'Context',
    compact: 'Compact',
    refreshFailed: 'Could not read /usage',
    expired: 'reset',
  },
  ko: {
    session: '세션',
    weekly: '주간',
    spend: '지출',
    context: '컨텍스트',
    compact: '압축',
    refreshFailed: '/usage를 읽지 못했습니다',
    expired: '재설정됨',
  },
} as const

export const t = (lang: Lang) => TEXT[lang]

export function isKorean(value: string): boolean {
  return /^ko([-_.]|$)|korean|한국|한글/i.test(value.trim())
}

export function label(kind: string, lang: Lang): string {
  const s = t(lang)
  if (kind === 'five_hour') return s.session
  if (kind === 'seven_day') return s.weekly
  if (kind === 'spend_limit') return s.spend
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  if (model) return `${model.charAt(0).toUpperCase()}${model.slice(1)}`
  return kind
}

// "1h3m", "6d14h", "45m"
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h${mins}m`
  return `${mins}m`
}

// The window has reset since the last reading, so its percent is stale
export function isExpired(limit: Limit, now: number): boolean {
  if (!limit.resetsAt) return false
  const at = Date.parse(limit.resetsAt)
  return !Number.isNaN(at) && at <= now
}

// Time left until the window resets, as "1h3m" or "6d14h"
export function resetText(limit: Limit, now: number): string | undefined {
  if (!limit.resetsAt) return undefined
  const at = Date.parse(limit.resetsAt)
  if (Number.isNaN(at) || at <= now) return undefined
  return duration(at - now)
}

export function contextPercent(context: Context): number | undefined {
  if (context.percent !== undefined) return Math.round(context.percent)
  if (context.tokens !== undefined && context.window > 0) {
    return Math.round((context.tokens / context.window) * 100)
  }
  return undefined
}

const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}/u

// Cells a text takes on the band: Hangul, CJK and emoji take two
export function cells(text: string): number {
  let n = 0
  for (const ch of text) n += WIDE.test(ch) ? 2 : 1
  return n
}

// The cells a reading takes: name, percent and detail, one cell apart
export function span(reading: Reading): number {
  const parts = [reading.name]
  if (reading.percent !== undefined) parts.push(`${reading.percent}%`)
  if (reading.detail) parts.push(reading.detail)
  return parts.reduce((sum, part) => sum + cells(part), parts.length - 1)
}

// Cells a line of readings takes, three cells apart
export function lineCells(readings: readonly Reading[]): number {
  return readings.reduce((sum, reading) => sum + span(reading), 0) + 3 * Math.max(0, readings.length - 1)
}

// Theme keys, so the colors stay readable on light and dark themes
export function tone(percent: number): string | undefined {
  if (percent >= 90) return 'error'
  if (percent >= 70) return 'warning'
  return undefined
}

export function order(limits: Limit[]): Limit[] {
  const rank = (k: string) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : 2)
  return [...limits].sort((a, b) => rank(a.kind) - rank(b.kind) || a.kind.localeCompare(b.kind))
}

// The engine's readings carry exact reset times; /usage adds the per-model
// weeks and keeps the percents current between replies
export function merge(engine: readonly Limit[], plan: readonly Limit[], now: number): Limit[] {
  const byKind = new Map(plan.map(limit => [limit.kind, limit] as const))
  for (const limit of engine) {
    const other = byKind.get(limit.kind)
    if (!other || (limit.at ?? 0) >= (other.at ?? 0)) byKind.set(limit.kind, limit)
    else if (limit.resetsAt && !isExpired(limit, now)) byKind.set(limit.kind, { ...other, resetsAt: limit.resetsAt })
  }
  return order([...byKind.values()])
}
