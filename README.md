# claude-desktop-usage-band

Keeps your Claude usage limits on screen, right above the Claude Code prompt, in the Claude desktop app's Code tab and in the terminal.

```
5h 21% (74% elapsed; ↻ in 1h 16m)   Weekly 3% (13% elapsed; ↻ in 6d 2h 56m)   Context 11% 112k/1M [Compact]
5시간 21% (74% 경과; ↻ 1시간 16분 후)   주간 3% (13% 경과; ↻ 6일 2시간 56분 후)   컨텍스트 11% 112k/1M [압축]
```

- **5h / Weekly**: how much of the limit is used (yellow from 70%, red from 90%), how much of the window has passed, and when it resets.
- **Context**: how full the context window is. **Compact** runs `/compact`.
- **Language**: English or Korean, picked automatically. See [Language](#language) to force one.
- The band appears once the session's first reply arrives, since the limits come with each response. A window that resets before the next reply shows `reset · updates on next reply` instead of its old percent.
- Per-model weekly limits, such as "Weekly · Fable" in the desktop app's usage popover, are not shown: Claude Code passes plugins only the 5-hour and weekly windows (and a gateway's spend limit, if you use one).

## Install

1. Clone the repository.

   ```
   git clone https://github.com/dydtjr1128/claude-desktop-usage-band.git
   ```

2. Point `CLAUDE_CODE_PLUGIN_DIRS` at the cloned folder in `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`). Use the absolute path, and merge it into the existing `env` block if you have one.

   Windows (double each backslash):

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\you\\claude-desktop-usage-band"
     }
   }
   ```

   macOS / Linux:

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-desktop-usage-band"
     }
   }
   ```

   For several plugin folders, separate the paths with `;` on Windows and `:` on macOS / Linux.

3. Quit the Claude desktop app completely and start it again (or restart `claude`). The band shows up after the first reply.

To try it once in a terminal without changing settings: `claude --plugin-dir <path to the folder>`.

To update, run `git pull` in the folder and restart the app. To uninstall, remove this folder's path from `CLAUDE_CODE_PLUGIN_DIRS` (the whole entry if it was the only path) and restart.

### Troubleshooting

- `claude plugin list` should list `usage-band@inline` as loaded. If it does not, check that `settings.json` is still valid JSON: a missing comma after the previous `env` entry, or single backslashes in a Windows path, breaks the whole file.
- Function-hook plugins are early access. If `claude --debug` reports the module was not loaded because function hooks are off, add `"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"` to the same `env` block and restart.

### Language

`auto` (the default) follows Claude Code's `language` setting, then `LC_ALL` / `LC_MESSAGES` / `LANG`, then the system locale.

To force one, open `/config` in a terminal `claude` session and set `usage-band` → Language. The desktop app has no `/config`, so add this to `~/.claude/settings.json` instead (`"ko"` or `"en"`):

```json
{
  "pluginConfigs": {
    "usage-band": {
      "options": { "language": "ko" }
    }
  }
}
```

## 설치 (한국어)

Claude 데스크톱 앱 Code 탭과 터미널의 입력창 바로 위에 5시간·주간 사용 한도와 컨텍스트 사용량을 항상 띄워 줍니다.

1. 저장소를 클론합니다.

   ```
   git clone https://github.com/dydtjr1128/claude-desktop-usage-band.git
   ```

2. `~/.claude/settings.json`(Windows: `%USERPROFILE%\.claude\settings.json`)의 `env`에 클론한 폴더의 절대 경로를 넣습니다. 이미 `env` 블록이 있으면 그 안에 한 줄만 추가하세요. Windows 경로는 `\`를 `\\`로 두 번 써야 합니다.

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\사용자\\claude-desktop-usage-band"
     }
   }
   ```

   macOS / Linux는 `"~/claude-desktop-usage-band"`처럼 적으면 됩니다. 플러그인 폴더가 여러 개면 Windows는 `;`, macOS / Linux는 `:`로 구분합니다.

3. Claude 데스크톱 앱을 완전히 종료했다가 다시 실행합니다(터미널이면 `claude` 재시작). 세션에서 첫 응답이 온 뒤부터 바가 보입니다.

설정을 바꾸지 않고 한 번만 써 보려면 터미널에서 `claude --plugin-dir <폴더 경로>`로 실행하세요. 업데이트는 폴더에서 `git pull` 후 앱 재시작입니다. 제거할 때는 `CLAUDE_CODE_PLUGIN_DIRS`에서 이 폴더 경로만 지우고(경로가 이것 하나뿐이면 항목 전체 삭제) 재시작하세요.

**문제 해결**: `claude plugin list`에 `usage-band@inline`이 loaded로 보여야 합니다. 안 보이면 `settings.json`이 올바른 JSON인지 확인하세요. 앞 줄 끝의 쉼표가 빠지거나 Windows 경로의 `\`를 한 번만 쓰면 파일 전체가 깨집니다. `claude --debug`에 function hooks가 꺼져 있어 모듈을 불러오지 않았다고 나오면, 같은 `env`에 `"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"`을 추가하고 재시작하세요.

**언어**: 기본값 `auto`는 Claude Code의 `language` 설정, `LC_ALL` / `LC_MESSAGES` / `LANG`, 시스템 로캘 순서로 따라갑니다(한국어 Windows면 자동으로 한국어). 고정하려면 터미널 `claude`의 `/config` → `usage-band` → Language에서 고르거나, `/config`가 없는 데스크톱 앱에서는 위 [Language](#language)의 `pluginConfigs` 설정을 `settings.json`에 추가하세요.

**참고**: 데스크톱 앱 사용량 팝업의 "주간 · Fable" 같은 모델별 주간 한도는 표시되지 않습니다. Claude Code가 플러그인에 5시간·주간 한도(게이트웨이를 쓰면 지출 한도까지)만 넘겨주기 때문입니다. 다음 응답 전에 한도가 재설정되면 이전 사용률 대신 `재설정됨 · 다음 응답 때 갱신`으로 표시합니다.

## Development

```
claude plugin validate .
claude plugin test .
```

Built on Claude Code's function-hook plugins (early access), tested with Claude Code 2.1.288.
