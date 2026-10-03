import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Context, Lang, Limit, Reading } from '../types'
import {
  cells,
  contextPercent,
  isExpired,
  isKorean,
  label,
  lineCells,
  merge,
  resetText,
  t,
  tone,
} from './format'
import { parseUsage } from './usage'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const plan = atom({ plugin: 'usage-band', key: 'plan' } as const, [] as Limit[])
const context = atom({ plugin: 'usage-band', key: 'context' } as const, null as Context | null)
const lang = atom({ plugin: 'usage-band', key: 'lang' } as const, 'en' as Lang)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)
const refreshing = atom({ plugin: 'usage-band', key: 'refreshing' } as const, false)

const INTERVALS: Record<string, number> = { '5m': 5 * 60000, '15m': 15 * 60000 }
// A /usage reading another session took this recently is used as it is
const SHARED_FOR = 4 * 60000

// Compact shows once the context is filling up
const COMPACT_FROM = 60
const REFRESH = '↻'
const REFRESHING = '⋯'

type Shared = { at: number; limits: Limit[] }

let polling = false
let loading: Promise<void> | undefined

// Order: this plugin's own option, Claude Code's `language` setting, the
// locale variables, then the runtime's locale. Anything Korean picks ko.
async function detectLang($: EngineInterface, preference: unknown): Promise<Lang> {
  if (preference === 'en' || preference === 'ko') return preference
  try {
    const { language } = await $.settings.read()
    if (typeof language === 'string' && language.trim()) {
      return isKorean(language) ? 'ko' : 'en'
    }
  } catch {}
  const locale =
    (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  if (locale) return isKorean(locale) ? 'ko' : 'en'
  try {
    if (isKorean(Intl.DateTimeFormat().resolvedOptions().locale)) return 'ko'
  } catch {}
  return 'en'
}

async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
}

const stamp = (list: readonly Limit[], at: number): Limit[] => list.map(limit => ({ ...limit, at }))

// A background `claude -p /usage`: the figures of the app's usage popover, the
// per-model weeks included. Hooks are off in the child so the user's hooks do
// not fire on every refresh and its copy of this plugin stays idle; the
// variable is a second guard against a chain of children.
async function fetchPlan($: EngineInterface): Promise<Limit[] | undefined> {
  const exe = (await $.env.get('CLAUDE_CODE_EXECPATH')) || 'claude'
  try {
    const { exitCode, stdout } = await $.process.run(
      [exe, '-p', '/usage', '--no-session-persistence', '--strict-mcp-config', '--settings', '{"disableAllHooks":true}'],
      { env: { USAGE_BAND_CHILD: '1' }, timeoutMs: 60000 },
    )
    if (exitCode !== 0) return undefined
    const limits = parseUsage(stdout, await $.clock.now())
    return limits.length > 0 ? limits : undefined
  } catch {
    return undefined
  }
}

// One /usage run at a time; `force` (the Refresh button) skips a shared reading
function refresh($: EngineInterface, force: boolean): Promise<void> {
  loading ??= load($, force)
    .catch(() => {})
    .finally(() => {
      loading = undefined
    })
  return loading
}

async function load($: EngineInterface, force: boolean): Promise<void> {
  const at = await $.clock.now()
  const shared = (await $.store.get('plan').catch(() => undefined)) as Shared | undefined
  if (!force && shared && at - shared.at < SHARED_FOR) {
    await update($, plan, () => shared.limits)
    return
  }
  await update($, refreshing, () => true)
  try {
    const fetched = await fetchPlan($)
    if (fetched) {
      await update($, plan, () => fetched)
      await $.store.set('plan', { at, limits: fetched } satisfies Shared).catch(() => {})
    } else if (force) {
      $.ui.toast(t(await read($, lang)).refreshFailed)
    }
  } finally {
    await update($, refreshing, () => false)
  }
}

// /usage runs only for a session someone looks at: the terminal draws from the
// start, the desktop app once it attaches. Never inside the /usage child.
async function poll($: EngineInterface, every: number | undefined): Promise<void> {
  if (every === undefined || polling || (await $.env.get('USAGE_BAND_CHILD'))) return
  polling = true
  void refresh($, false)
  $.clock.every(every, () => {
    void $.session.surfaces().then(surfaces => (surfaces.length > 0 ? refresh($, false) : undefined))
  })
}

export const register: Register = (on, options) => {
  const every = INTERVALS[String(options.refresh)]

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const at = await $.clock.now()
    const usage = await $.session.usage()
    const detected = await detectLang($, options.language)
    await update($, limits, () => stamp(usage.rateLimits, at))
    await update($, context, () => usage.context)
    await update($, lang, () => detected)
    await tick($)
    // Redraw the countdowns once a minute
    $.clock.every(60000, () => void tick($))
    if (e.surface) await poll($, every)
    return result
  })

  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    await poll($, every)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const at = await $.clock.now()
    if (e.changed.includes('rateLimits')) await update($, limits, () => stamp(e.rateLimits, at))
    if (e.changed.includes('context')) await update($, context, () => e.context)
    await tick($)
    return next(e)
  })

  on('config.set', async ($, e, next) => {
    const result = await next(e)
    if (e.key === 'language') {
      const detected = await detectLang($, options.language)
      await update($, lang, () => detected)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const at = await read($, now)
    const current = merge(await read($, limits), await read($, plan), at)
    const ctx = await read($, context)
    const ctxPercent = ctx ? contextPercent(ctx) : undefined
    const busy = await read($, refreshing)
    if (current.length === 0 && ctxPercent === undefined && !busy) return next(e)

    const l = await read($, lang)
    const s = t(l)
    const readings: Reading[] = current.map(limit => {
      const name = label(limit.kind, l)
      if (isExpired(limit, at)) return { key: limit.kind, name, detail: s.expired }
      return { key: limit.kind, name, percent: Math.round(limit.percentUsed), detail: resetText(limit, at) }
    })
    if (ctxPercent !== undefined) readings.push({ key: 'context', name: s.context, percent: ctxPercent })
    const compact = ctxPercent !== undefined && ctxPercent >= COMPACT_FROM && !e.props.isWorking
    // The buttons and the gap before them come off the band's width
    const room = e.props.bodyColumns - (compact ? cells(s.compact) + 5 : 0) - cells(REFRESH) - 2
    // Too narrow for the times: the percents alone, and past that the line is cut
    const line =
      lineCells(readings) <= room
        ? readings
        : readings.map(reading => (reading.percent === undefined ? reading : { ...reading, detail: undefined }))
    const { Box, Button, Text } = $.ui.resolve(e)

    // Always one line: the readings on the left, the buttons at the right edge
    return (
      <Box flexDirection="row" alignItems="center" columnGap={2}>
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end">
            {line.map((reading, i) => (
              <Text key={reading.key}>
                {i > 0 ? '   ' : null}
                <Text>{reading.name}</Text>
                {reading.percent === undefined ? null : ' '}
                {reading.percent === undefined ? null : (
                  <Text bold color={tone(reading.percent)}>{`${reading.percent}%`}</Text>
                )}
                {reading.detail ? ' ' : null}
                {reading.detail ? <Text dimColor>{reading.detail}</Text> : null}
              </Text>
            ))}
          </Text>
        </Box>
        <Box key="actions" flexDirection="row" flexShrink={0} columnGap={1}>
          {compact ? (
            <Button
              key="compact"
              label={s.compact}
              onPress={async () => {
                // Rejects when a turn starts between the draw and the press
                try {
                  await $.session.compact()
                } catch (err) {
                  $.ui.toast(err instanceof Error ? err.message : String(err))
                }
              }}
            />
          ) : null}
          <Button key="refresh" plain dimColor label={busy ? REFRESHING : REFRESH} onPress={() => refresh($, true)} />
        </Box>
      </Box>
    )
  })
}
