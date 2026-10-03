export type Lang = 'en' | 'ko'
// `at`: when the reading was taken, so the newer of two readings of one window wins
export type Limit = { kind: string; percentUsed: number; resetsAt?: string; at?: number }
export type Context = { tokens?: number; window: number; percent?: number }
// One entry on the band: a limit or the context
export type Reading = { key: string; name: string; percent?: number; detail?: string }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      limits: Limit[]
      plan: Limit[]
      context: Context | null
      lang: Lang
      now: number
      refreshing: boolean
    }
  }
}
