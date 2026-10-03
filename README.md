# claude-desktop-usage-band

Keeps your Claude usage limits on screen, right above the Claude Code prompt, in the Claude desktop app's Code tab and in the terminal.

```
5h 21% (74% elapsed; ↻ in 1h 16m)   Weekly 3% (13% elapsed; ↻ in 6d 2h 56m)   Context 11% 112k/1M [Compact]
5시간 21% (74% 경과; ↻ 1시간 16분 후)   주간 3% (13% 경과; ↻ 6일 2시간 56분 후)   컨텍스트 11% 112k/1M [압축]
```

- **5h / Weekly**: how much of the limit is used (yellow from 70%, red from 90%), how much of the window has passed, and when it resets.
- **Context**: how full the context window is. **Compact** runs `/compact`.
- **Language**: English or Korean. `auto` follows Claude Code's `language` setting, then `LC_ALL` / `LC_MESSAGES` / `LANG`, then the system locale. To force one, open `/config` and set `usage-band` → Language.
- The band appears once the session's first reply arrives, since the limits come with each response. Per-model weekly limits show up only when Claude Code reports them.

## Install

1. Clone the repository.

   ```
   git clone https://github.com/dydtjr1128/claude-desktop-usage-band.git
   ```

2. Point `CLAUDE_CODE_PLUGIN_DIRS` at the folder in `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`). Merge it into an existing `env` block if you have one.

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-desktop-usage-band"
     }
   }
   ```

3. Restart the Claude desktop app or `claude`.

To try it once in a terminal: `claude --plugin-dir <path to the folder>`.

## 설치 (한국어)

1. `git clone https://github.com/dydtjr1128/claude-desktop-usage-band.git`
2. `~/.claude/settings.json`의 `env`에 `"CLAUDE_CODE_PLUGIN_DIRS": "<클론한 폴더 경로>"` 추가
3. Claude 데스크톱 앱 또는 `claude` 재시작

언어는 자동으로 따라가며, `/config` → `usage-band` → Language에서 `ko` / `en`으로 고정할 수 있습니다.

## Development

```
claude plugin validate .
claude plugin test .
```

Built on Claude Code's function-hook plugins (early access), tested with Claude Code 2.1.288.
