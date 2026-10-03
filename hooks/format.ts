import type { Context, Lang, Limit, Reading } from '../types'

const TEXT = {
  en: {
    session: 'Session',
    weekly: 'Weekly · All models',
    weeklyFor: (model: string) => `Weekly · ${model}`,
    spend: 'Spend',
    context: 'Context',
    of: (used: string, total: string) => `${used} of ${total}`,
    compact: 'Compact',
    refreshFailed: 'Could not read /usage',
    resetsIn: (left: string) => `resets in ${left}`,
    resetsOn: (when: string) => `resets ${when}`,
    expired: 'reset',
    units: ['d', 'h', 'm'],
    locale: 'en-US',
  },
  ko: {
    session: '세션 한도',
    weekly: '주간 · 모든 모델',
    weeklyFor: (model: string) => `주간 · ${model}`,
    spend: '사용 한도',
    context: '컨텍스트',
    of: (used: string, total: string) => `${total} 중 ${used}`,
    compact: '압축',
    refreshFailed: '/usage를 읽지 못했습니다',
    resetsIn: (left: string) => `${left} 후 재설정`,
    resetsOn: (when: string) => `${when} 재설정`,
    expired: '재설정됨',
    units: ['일', '시간', '분'],
    locale: 'ko-KR',
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
  if (model) return s.weeklyFor(`${model.charAt(0).toUpperCase()}${model.slice(1)}`)
  return kind
}

export function duration(ms: number, lang: Lang): string {
  const [d, h, m] = t(lang).units
  const total = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return `${days}${d} ${hours}${h} ${mins}${m}`
  if (hours > 0) return `${hours}${h} ${mins}${m}`
  return `${mins}${m}`
}

// "Sat 8:00 AM" / "토 오전 8:00", in the machine's time zone
export function day(at: number, lang: Lang): string {
  const { locale } = t(lang)
  const date = new Date(at)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date)
  // Newer ICU puts a narrow no-break space before AM/PM
  return `${weekday} ${time}`.replace(/\s/g, ' ')
}

// The window has reset since the last reading, so its percent is stale
export function isExpired(limit: Limit, now: number): boolean {
  if (!limit.resetsAt) return false
  const at = Date.parse(limit.resetsAt)
  return !Number.isNaN(at) && at <= now
}

// The 5-hour window counts down; the weekly ones name the day, as the app's popover does
export function resetText(limit: Limit, now: number, lang: Lang): string | undefined {
  if (!limit.resetsAt) return undefined
  const at = Date.parse(limit.resetsAt)
  if (Number.isNaN(at) || at <= now) return undefined
  const s = t(lang)
  return limit.kind === 'five_hour' ? s.resetsIn(duration(at - now, lang)) : s.resetsOn(day(at, lang))
}

export function tokens(n: number): string {
  if (n >= 1000000) return `${Number((n / 1000000).toFixed(1))}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export function contextPercent(context: Context): number | undefined {
  if (context.percent !== undefined) return Math.round(context.percent)
  if (context.tokens !== undefined && context.window > 0) {
    return Math.round((context.tokens / context.window) * 100)
  }
  return undefined
}

// "112k of 1M" / "1M 중 112k"
export function contextDetail(context: Context, lang: Lang): string | undefined {
  if (context.tokens === undefined) return undefined
  return t(lang).of(tokens(context.tokens), tokens(context.window))
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

// How the readings sit on the band so that rows which wrap still line up:
// 0 when all of them fit in one row, else how many equal columns, two or one
export function columns(widths: readonly number[], room: number): number {
  const total = widths.reduce((sum, w) => sum + w, 0) + 3 * Math.max(0, widths.length - 1)
  if (total <= room) return 0
  return Math.max(...widths) * 2 + 6 <= room ? 2 : 1
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
