import { describe as group, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import { detail, duration, isExpired, isKorean, merge, tokens } from '../hooks/format'
import { parseReset, parseUsage } from '../hooks/usage'

const NOW = Date.parse('2026-10-03T05:00:00Z')
const MIN = 60000
// 1h 16m 59s and 6d 2h 56m 59s left, as in the reference screenshot
const FIVE_HOUR = { kind: 'five_hour', percentUsed: 21, resetsAt: new Date(NOW + 76 * MIN + 59000).toISOString() }
const WEEKLY = { kind: 'seven_day', percentUsed: 3, resetsAt: new Date(NOW + (6 * 1440 + 2 * 60 + 56) * MIN + 59000).toISOString() }
const CONTEXT = { tokens: 112000, window: 1000000, percent: 11.2 }
// What `claude -p /usage` printed, word for word
const USAGE = [
  'You are currently using your subscription to power your Claude Code usage',
  '',
  'Current session: 6% used · resets Oct 3, 6:29pm (Asia/Seoul)',
  'Current week (all models): 3% used · resets Oct 10, 7:59am (Asia/Seoul)',
  'Current week (Fable): 0% used · resets Oct 10, 8am (Asia/Seoul)',
  '',
  "What's contributing to your limits usage?",
].join('\n')
const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 160,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} satisfies RenderPropsOf['AbovePrompt']

type World = {
  language?: string
  env?: Record<string, string>
  store?: Record<string, unknown>
  usage?: { exitCode: number; stdout: string }
}

function engine(on: On, world: World = {}) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, world.env ?? {})
  mock.store(on, world.store)
  const runs: (readonly string[])[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('session.surfaces', () => ({ value: ['terminal'] as const }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: CONTEXT, rateLimits: [WEEKLY, FIVE_HOUR] } }))
  on('settings.read', () => ({ value: world.language ? { language: world.language } : {} }))
  on('process.run', (_$, e) => {
    runs.push(e.argv)
    const { exitCode, stdout } = world.usage ?? { exitCode: 0, stdout: USAGE }
    return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { clock, runs }
}

function band($: Engine, surface: 'terminal' | 'desktop', isWorking = false) {
  return $.ui.mount({
    plugin: 'usage-band',
    surface,
    component: 'AbovePrompt',
    props: { ...PROPS, isWorking },
  })
}

group('format', () => {
  test('durations', () => {
    expect(duration(76 * MIN + 59000, 'en')).toBe('1h 16m')
    expect(duration((6 * 1440 + 2 * 60 + 56) * MIN, 'ko')).toBe('6일 2시간 56분')
    expect(duration(5 * MIN, 'ko')).toBe('5분')
  })
  test('elapsed share of the window', () => {
    expect(detail(FIVE_HOUR, NOW, 'en')).toBe('(74% elapsed; ↻ in 1h 16m)')
    expect(detail(WEEKLY, NOW, 'en')).toBe('(13% elapsed; ↻ in 6d 2h 56m)')
    expect(detail(FIVE_HOUR, NOW, 'ko')).toBe('(74% 경과; ↻ 1시간 16분 후)')
    expect(detail({ kind: 'spend_limit', percentUsed: 5 }, NOW, 'en')).toBeUndefined()
  })
  test('a window past its reset time is expired', () => {
    const past = { kind: 'five_hour', percentUsed: 92, resetsAt: new Date(NOW - MIN).toISOString() }
    expect(isExpired(past, NOW)).toBe(true)
    expect(isExpired(FIVE_HOUR, NOW)).toBe(false)
    expect(isExpired({ kind: 'spend_limit', percentUsed: 5 }, NOW)).toBe(false)
    expect(detail(past, NOW, 'en')).toBeUndefined()
  })
  test('token counts', () => {
    expect(tokens(112000)).toBe('112k')
    expect(tokens(1000000)).toBe('1M')
    expect(tokens(200000)).toBe('200k')
  })
  test('korean detection', () => {
    expect(isKorean('ko_KR.UTF-8')).toBe(true)
    expect(isKorean('ko-KR')).toBe(true)
    expect(isKorean('korean')).toBe(true)
    expect(isKorean('한국어')).toBe(true)
    expect(isKorean('en_US.UTF-8')).toBe(false)
    expect(isKorean('kokoro')).toBe(false)
  })
})

test('English band like the reference', async ($, on) => {
  // An English locale, so the machine's own locale cannot pick Korean
  engine(on, { env: { LANG: 'en_US.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await band($, surface)
    for (const text of ['5h', '21%', '(74% elapsed; ↻ in 1h 16m)', 'Weekly', '3%', '(13% elapsed; ↻ in 6d 2h 56m)', 'Context', '11%', '112k/1M']) {
      expect(await ui.find({ type: 'Text', text })).toBeDefined()
    }
    expect((await ui.find({ key: 'compact' }))?.props.label).toBe('Compact')
    await ui.unmount()
  }
})

test('Korean from the Claude Code language setting', async ($, on) => {
  engine(on, { language: 'korean' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await band($, surface)
    for (const text of ['5시간', '(74% 경과; ↻ 1시간 16분 후)', '주간', '(13% 경과; ↻ 6일 2시간 56분 후)', '컨텍스트']) {
      expect(await ui.find({ type: 'Text', text })).toBeDefined()
    }
    expect((await ui.find({ key: 'compact' }))?.props.label).toBe('압축')
    await ui.unmount()
  }
})

test('Korean from the system locale', async ($, on) => {
  engine(on, { env: { LANG: 'ko_KR.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await band($, 'desktop')
  expect(await ui.find({ type: 'Text', text: '5시간' })).toBeDefined()
  await ui.unmount()
})

test('the plugin option wins', { options: { language: 'en' } }, async ($, on) => {
  engine(on, { language: '한국어', env: { LANG: 'ko_KR.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: '5h' })).toBeDefined()
  await ui.unmount()
})

test('Korean can be forced', { options: { language: 'ko' } }, async ($, on) => {
  engine(on, { env: { LANG: 'en_US.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await band($, 'desktop')
  expect(await ui.find({ type: 'Text', text: '5시간' })).toBeDefined()
  await ui.unmount()
})

test('Compact compacts, and hides while a turn runs', async ($, on) => {
  engine(on)
  let compacted = 0
  on('session.compact', () => {
    compacted += 1
    return { skip: 'test' }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await band($, surface)
    await ui.press({ key: 'compact' })
    await ui.unmount()
    const busy = await band($, surface, true)
    expect(await busy.find({ key: 'compact' })).toBeUndefined()
    await busy.unmount()
  }
  expect(compacted).toBe(2)
})

test('a measurement redraws the band on screen', async ($, on) => {
  engine(on)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: '21%' })).toBeDefined()
  await $.session.measure({
    context: { window: 1000000, tokens: 500000, percent: 50 },
    rateLimits: [{ ...FIVE_HOUR, percentUsed: 92 }],
    changed: ['rateLimits', 'context'],
  })
  const pct = await ui.find({ type: 'Text', text: '92%' })
  expect(pct?.props.color).toBe('error')
  expect(await ui.find({ type: 'Text', text: '500k/1M' })).toBeDefined()
  await ui.unmount()
})

test('a window past its reset drops the stale percent', async ($, on) => {
  engine(on, { env: { LANG: 'en_US.UTF-8' } })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: CONTEXT,
    rateLimits: [{ ...FIVE_HOUR, percentUsed: 92, resetsAt: new Date(NOW - MIN).toISOString() }, WEEKLY],
    changed: ['rateLimits'],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await band($, surface)
    expect(await ui.find({ type: 'Text', text: '5h' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'reset' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '92%' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '(13% elapsed; ↻ in 6d 2h 56m)' })).toBeDefined()
    await ui.unmount()
  }
})

group('/usage', () => {
  test('reads the windows it prints', () => {
    const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString()
    expect(parseUsage(USAGE, NOW)).toEqual([
      { kind: 'five_hour', percentUsed: 6, resetsAt: local(3, 18, 30), at: NOW },
      { kind: 'seven_day', percentUsed: 3, resetsAt: local(10, 8), at: NOW },
      { kind: 'seven_day_fable', percentUsed: 0, resetsAt: local(10, 8), at: NOW },
    ])
    expect(parseUsage('Usage is not available for API keys', NOW)).toEqual([])
  })
  test('reset times', () => {
    const noon = new Date(2026, 9, 3, 12).getTime()
    expect(parseReset('Oct 3, 6:29pm', noon)).toBe(new Date(2026, 9, 3, 18, 30).toISOString())
    // a time with no date that has passed is tomorrow's
    expect(parseReset('9am', noon)).toBe(new Date(2026, 9, 4, 9).toISOString())
    // December's "Jan 2" is next year's
    expect(parseReset('Jan 2, 8am', new Date(2026, 11, 30, 12).getTime())).toBe(new Date(2027, 0, 2, 8).toISOString())
    expect(parseReset('soon', noon)).toBeUndefined()
  })
  test('the newer percent wins, with the exact reset time of the engine', () => {
    const later = { kind: 'five_hour', percentUsed: 25, resetsAt: new Date(NOW + 77 * MIN).toISOString(), at: NOW }
    const older = { kind: 'seven_day', percentUsed: 2, resetsAt: WEEKLY.resetsAt, at: NOW - MIN }
    const fable = { kind: 'seven_day_fable', percentUsed: 0, resetsAt: WEEKLY.resetsAt, at: NOW }
    const merged = merge([{ ...FIVE_HOUR, at: NOW - MIN }, { ...WEEKLY, at: NOW }], [later, older, fable], NOW)
    expect(merged).toEqual([{ ...later, resetsAt: FIVE_HOUR.resetsAt }, { ...WEEKLY, at: NOW }, fable])
  })
})

test('a terminal session reads /usage at the start and every 5 minutes', async ($, on) => {
  const { clock, runs } = engine(on, { env: { LANG: 'en_US.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(runs.length).toBe(1)
  expect(runs[0].slice(1, 3)).toEqual(['-p', '/usage'])
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: 'Weekly · Fable' })).toBeDefined()
  await ui.unmount()
  await clock.advance(5 * MIN)
  expect(runs.length).toBe(2)
})

test('a session nobody looks at never runs /usage', async ($, on) => {
  const { clock, runs } = engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await clock.advance(15 * MIN)
  expect(runs.length).toBe(0)
})

test('the desktop app attaching starts the reads', async ($, on) => {
  const { clock, runs } = engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  await clock.settle()
  expect(runs.length).toBe(1)
})

test('the /usage child stays idle', async ($, on) => {
  const { clock, runs } = engine(on, { env: { USAGE_BAND_CHILD: '1' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(runs.length).toBe(0)
})

test('off reads only on Refresh', { options: { refresh: 'off' } }, async ($, on) => {
  const { clock, runs } = engine(on, { env: { LANG: 'en_US.UTF-8' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(20 * MIN)
  expect(runs.length).toBe(0)
  const ui = await band($, 'desktop')
  await ui.press({ key: 'refresh' })
  expect(runs.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'Weekly · Fable' })).toBeDefined()
  await ui.unmount()
})

test("another session's fresh reading is reused", async ($, on) => {
  const fable = { kind: 'seven_day_fable', percentUsed: 4, resetsAt: WEEKLY.resetsAt, at: NOW - MIN }
  const { clock, runs } = engine(on, { env: { LANG: 'en_US.UTF-8' }, store: { plan: { at: NOW - MIN, limits: [fable] } } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(runs.length).toBe(0)
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: '4%' })).toBeDefined()
  await ui.unmount()
})

test('a failed /usage leaves the engine readings', async ($, on) => {
  const { clock } = engine(on, { env: { LANG: 'en_US.UTF-8' }, usage: { exitCode: 1, stdout: '' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: '21%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Weekly · Fable' })).toBeUndefined()
  await ui.unmount()
})
