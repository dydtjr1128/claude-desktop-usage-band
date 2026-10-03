export type Lang = 'en' | 'ko'
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Context = { tokens?: number; window: number; percent?: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      limits: Limit[]
      context: Context | null
      lang: Lang
      now: number
    }
  }
}
