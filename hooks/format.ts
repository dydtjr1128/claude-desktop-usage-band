import type { Context, Lang, Limit } from '../types'

const HOUR = 3600000
const DAY = 24 * HOUR

const TEXT = {
  en: {
    fiveHour: '5h',
    weekly: 'Weekly',
    spend: 'Spend',
    context: 'Context',
    compact: 'Compact',
    elapsed: (p: number) => `${p}% elapsed`,
    resetsIn: (d: string) => `↻ in ${d}`,
    expired: 'reset',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    refreshFailed: 'Could not read /usage',
    units: ['d', 'h', 'm'],
  },
  ko: {
    fiveHour: '5시간',
    weekly: '주간',
    spend: '사용 한도',
    context: '컨텍스트',
    compact: '압축',
    elapsed: (p: number) => `${p}% 경과`,
    resetsIn: (d: string) => `↻ ${d} 후`,
    expired: '재설정됨',
    refresh: '새로고침',
    refreshing: '새로고침 중…',
    refreshFailed: '/usage를 읽지 못했습니다',
    units: ['일', '시간', '분'],
  },
} as const

export const t = (lang: Lang) => TEXT[lang]

export function isKorean(value: string): boolean {
  return /^ko([-_.]|$)|korean|한국|한글/i.test(value.trim())
}

export function windowMs(kind: string): number | undefined {
  if (kind === 'five_hour') return 5 * HOUR
  if (kind.startsWith('seven_day')) return 7 * DAY
  return undefined
}

export function label(kind: string, lang: Lang): string {
  const s = t(lang)
  if (kind === 'five_hour') return s.fiveHour
  if (kind === 'seven_day') return s.weekly
  if (kind === 'spend_limit') return s.spend
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  if (model) return `${s.weekly} · ${model.charAt(0).toUpperCase()}${model.slice(1)}`
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

// The window has reset since the last reading, so its percent is stale
export function isExpired(limit: Limit, now: number): boolean {
  if (!limit.resetsAt) return false
  const at = Date.parse(limit.resetsAt)
  return !Number.isNaN(at) && at <= now
}

// "(74% elapsed; ↻ in 1h 16m)" / "(74% 경과; ↻ 1시간 16분 후)"
export function detail(limit: Limit, now: number, lang: Lang): string | undefined {
  if (!limit.resetsAt) return undefined
  const s = t(lang)
  const left = Date.parse(limit.resetsAt) - now
  if (Number.isNaN(left) || left <= 0) return undefined
  const reset = s.resetsIn(duration(left, lang))
  const span = windowMs(limit.kind)
  if (span === undefined) return `(${reset})`
  const elapsed = Math.min(100, Math.max(0, Math.round(((span - left) / span) * 100)))
  return `(${s.elapsed(elapsed)}; ${reset})`
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

export function contextDetail(context: Context): string | undefined {
  if (context.tokens === undefined) return undefined
  return `${tokens(context.tokens)}/${tokens(context.window)}`
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
