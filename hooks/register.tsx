import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Context, Lang, Limit } from '../types'
import {
  contextDetail,
  contextPercent,
  detail,
  isKorean,
  label,
  order,
  t,
  tone,
} from './format'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const context = atom({ plugin: 'usage-band', key: 'context' } as const, null as Context | null)
const lang = atom({ plugin: 'usage-band', key: 'lang' } as const, 'en' as Lang)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)

// Order: this plugin's own option, Claude Code's `language` setting, the
// locale variables, then the runtime's locale. Anything Korean picks ko.
async function detectLang($: EngineInterface, preference: unknown): Promise<Lang> {
  if (preference === 'en' || preference === 'ko') return preference
  try {
    const row = (await $.config.list()).find(r => r.key === 'language')
    if (typeof row?.value === 'string' && row.value && !row.value.startsWith('Default')) {
      return isKorean(row.value) ? 'ko' : 'en'
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

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    const detected = await detectLang($, options.language)
    await update($, limits, () => usage.rateLimits)
    await update($, context, () => usage.context)
    await update($, lang, () => detected)
    await tick($)
    // Redraw the countdowns once a minute
    $.clock.every(60000, () => void tick($))
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, limits, () => e.rateLimits)
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
    const current = order(await read($, limits))
    const ctx = await read($, context)
    const ctxPercent = ctx ? contextPercent(ctx) : undefined
    if (current.length === 0 && ctxPercent === undefined) return next(e)

    const l = await read($, lang)
    const at = await read($, now)
    const s = t(l)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3} alignItems="center">
        {current.map(limit => {
          const pct = Math.round(limit.percentUsed)
          const more = detail(limit, at, l)
          return (
            <Box key={limit.kind} flexDirection="row" columnGap={1}>
              <Text>{label(limit.kind, l)}</Text>
              <Text bold color={tone(pct)}>{`${pct}%`}</Text>
              {more ? <Text dimColor>{more}</Text> : null}
            </Box>
          )
        })}
        {ctx && ctxPercent !== undefined ? (
          <Box key="context" flexDirection="row" columnGap={1} alignItems="center">
            <Text>{s.context}</Text>
            <Text bold color={tone(ctxPercent)}>{`${ctxPercent}%`}</Text>
            {contextDetail(ctx) ? <Text dimColor>{contextDetail(ctx)}</Text> : null}
            {e.props.isWorking ? null : (
              <Button key="compact" label={s.compact} onPress={() => void $.session.compact()} />
            )}
          </Box>
        ) : null}
      </Box>
    )
  })
}
