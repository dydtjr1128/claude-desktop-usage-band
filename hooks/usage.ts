import type { Limit } from '../types'

const DAY = 24 * 3600000
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// "Current session: 6% used · resets Oct 3, 6:29pm (Asia/Seoul)"
// "Current week (Fable): 0% used · resets Oct 10, 8am (Asia/Seoul)"
const HEAD = /^Current (session|week \((.+?)\)): (\d+(?:\.\d+)?)% used/
const RESETS = /\bresets ([^(]+?)\s*(?:\(|$)/
const WHEN = /^(?:([A-Za-z]{3})[a-z]* (\d{1,2}), )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i

function kindOf(window: string, model: string | undefined): string {
  if (window === 'session') return 'five_hour'
  if (!model || model.toLowerCase() === 'all models') return 'seven_day'
  return `seven_day_${model.toLowerCase()}`
}

// The local time /usage prints, as an ISO instant
export function parseReset(text: string, now: number): string | undefined {
  const m = WHEN.exec(text.trim())
  if (!m) return undefined
  const today = new Date(now)
  const month = m[1] ? MONTHS.indexOf(m[1].toLowerCase()) : today.getMonth()
  if (month < 0) return undefined
  const day = m[2] ? Number(m[2]) : today.getDate()
  const hour = (Number(m[3]) % 12) + (m[5].toLowerCase() === 'pm' ? 12 : 0)
  let minute = Number(m[4] ?? 0)
  // /usage drops the seconds, so a reset at 8:00 prints as 7:59
  if (minute % 30 === 29) minute += 1
  let at = new Date(today.getFullYear(), month, day, hour, minute).getTime()
  // December's "Jan 2" is next year's; a time with no date that has passed is tomorrow's
  if (m[1] && at < now - 31 * DAY) at = new Date(today.getFullYear() + 1, month, day, hour, minute).getTime()
  if (!m[1] && at < now) at += DAY
  return new Date(at).toISOString()
}

export function parseUsage(text: string, now: number): Limit[] {
  const limits: Limit[] = []
  for (const line of text.split(/\r?\n/)) {
    const head = HEAD.exec(line.trim())
    if (!head) continue
    const when = RESETS.exec(line)?.[1]
    const resetsAt = when ? parseReset(when, now) : undefined
    limits.push({
      kind: kindOf(head[1], head[2]),
      percentUsed: Number(head[3]),
      ...(resetsAt ? { resetsAt } : {}),
      at: now,
    })
  }
  return limits
}
