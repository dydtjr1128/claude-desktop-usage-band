# claude-desktop-usage-band

Keeps the figures of the Claude desktop app's usage popover on screen, right above the Claude Code prompt, in the desktop app's Code tab and in the terminal, without hovering.

```
Session 5% / resets in 3h 4m   Weekly · All models 2% / resets Sat 8:00 AM   Weekly · Fable 0% / resets Sat 8:00 AM   Context 22% / 220k of 1M   [Compact] [Refresh]
세션 한도 5% / 3시간 4분 후 재설정   주간 · 모든 모델 2% / 토 오전 8:00 재설정   주간 · Fable 0% / 토 오전 8:00 재설정   컨텍스트 22% / 1M 중 220k   [압축] [새로고침]
```

- **Session / Weekly**: how much of each limit is used (yellow from 70%, red from 90%) and when it resets. The 5-hour session counts down; the weekly limits name the day and time. A limit whose reset time has passed shows `reset` until the next reading.
- **Per-model weeks** such as Weekly · Fable (which ones depends on your plan) come from a background `claude -p /usage` run, the same figures as the usage popover. See [How it refreshes](#how-it-refreshes).
- **Context**: how full the context window is, as Claude Code's status line counts it, so it can differ from the popover. **Compact** runs `/compact`.
- **Refresh** reads `/usage` at once.
- **Language**: English or Korean, picked automatically. See [Options](#options).

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
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\Users\you\claude-desktop-usage-band"
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

3. Quit the Claude desktop app completely and start it again (or restart `claude`). The band shows up a few seconds into a session.

To try it once in a terminal without changing settings: `claude --plugin-dir <path to the folder>`.

To update, run `git pull` in the folder and restart the app. To uninstall, remove this folder's path from `CLAUDE_CODE_PLUGIN_DIRS` (the whole entry if it was the only path) and restart.

### How it refreshes

- The session and weekly figures arrive with every reply.
- `/usage` runs only in sessions you can see: a terminal session from the start, a desktop session once the app attaches. It then runs every 5 minutes, and a session reuses a reading another session took in the last 4 minutes rather than running its own.
- Each run is a background `claude -p /usage` of about 5 seconds, with hooks and MCP servers off and no transcript saved.
- The countdowns redraw once a minute.

### Options

Both are rows of `/config` in a terminal `claude` session (`usage-band` → Language, Usage refresh). The desktop app has no `/config`, so set them in `~/.claude/settings.json` instead:

```json
{
  "pluginConfigs": {
    "usage-band": {
      "options": { "language": "ko", "refresh": "15m" }
    }
  }
}
```

- `language`: `auto` (the default) follows Claude Code's `language` setting, then `LC_ALL` / `LC_MESSAGES` / `LANG`, then the system locale. `en` or `ko` forces one.
- `refresh`: how often `/usage` runs: `5m` (the default), `15m`, or `off`, which runs it only when you press Refresh.

### Troubleshooting

- `claude plugin list` should list `usage-band@inline` as loaded. If it does not, check that `settings.json` is still valid JSON: a missing comma after the previous `env` entry, or single backslashes in a Windows path, breaks the whole file.
- Function-hook plugins are early access. If `claude --debug` reports the module was not loaded because function hooks are off, add `"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"` to the same `env` block and restart.
- No per-model line: `claude -p /usage` prints a `Current week (…)` line only for the limits your plan has, and none for API-key logins. Refresh shows a notice when `/usage` cannot be read.

## 설치 (한국어)

Claude 데스크톱 앱 사용량 팝업의 내용(세션 한도, 주간 · 모든 모델, 주간 · Fable 같은 모델별 주간 한도, 컨텍스트)을 마우스를 올리지 않아도 데스크톱 앱 Code 탭과 터미널의 입력창 바로 위에 항상 띄워 줍니다.

1. 저장소를 클론합니다.

   ```
   git clone https://github.com/dydtjr1128/claude-desktop-usage-band.git
   ```

2. `~/.claude/settings.json`(Windows: `%USERPROFILE%\.claude\settings.json`)의 `env`에 클론한 폴더의 절대 경로를 넣습니다. 이미 `env` 블록이 있으면 그 안에 한 줄만 추가하세요. Windows 경로는 `\`를 `\`로 두 번 써야 합니다.

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\Users\사용자\claude-desktop-usage-band"
     }
   }
   ```

   macOS / Linux는 `"~/claude-desktop-usage-band"`처럼 적으면 됩니다. 플러그인 폴더가 여러 개면 Windows는 `;`, macOS / Linux는 `:`로 구분합니다.

3. Claude 데스크톱 앱을 완전히 종료했다가 다시 실행합니다(터미널이면 `claude` 재시작). 세션이 시작되고 몇 초 뒤 바가 보입니다.

설정을 바꾸지 않고 한 번만 써 보려면 터미널에서 `claude --plugin-dir <폴더 경로>`로 실행하세요. 업데이트는 폴더에서 `git pull` 후 앱 재시작입니다. 제거할 때는 `CLAUDE_CODE_PLUGIN_DIRS`에서 이 폴더 경로만 지우고(경로가 이것 하나뿐이면 항목 전체 삭제) 재시작하세요.

**갱신 방식**: 세션·주간 한도는 응답이 올 때마다 갱신됩니다. 모델별 주간 한도는 백그라운드 `claude -p /usage`로 읽습니다. 바가 보이는 세션에서만 실행되고(터미널은 시작할 때부터, 데스크톱은 앱이 세션에 연결된 뒤), 그 뒤 5분마다 다시 읽습니다. 다른 세션이 4분 안에 읽은 결과가 있으면 그걸 씁니다. 한 번에 약 5초 걸리는 프로세스이고, 훅과 MCP 서버는 끄고 기록은 남기지 않습니다. **새로고침** 버튼을 누르면 바로 읽고, 남은 시간 표시는 1분마다 다시 그립니다.

**옵션**: 터미널 `claude`의 `/config` → `usage-band`에서 고르거나, `/config`가 없는 데스크톱 앱에서는 위 [Options](#options)의 `pluginConfigs`를 `settings.json`에 넣으세요.

- `language`: 기본값 `auto`는 Claude Code의 `language` 설정, `LC_ALL` / `LC_MESSAGES` / `LANG`, 시스템 로캘 순서로 따라갑니다(한국어 Windows면 자동으로 한국어). `ko` / `en`으로 고정할 수 있습니다.
- `refresh`: `/usage`를 읽는 주기입니다. `5m`(기본), `15m`, `off`(새로고침 버튼을 누를 때만) 중에서 고릅니다.

**문제 해결**: `claude plugin list`에 `usage-band@inline`이 loaded로 보여야 합니다. 안 보이면 `settings.json`이 올바른 JSON인지 확인하세요. 앞 줄 끝의 쉼표가 빠지거나 Windows 경로의 `\`를 한 번만 쓰면 파일 전체가 깨집니다. `claude --debug`에 function hooks가 꺼져 있어 모듈을 불러오지 않았다고 나오면, 같은 `env`에 `"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"`을 추가하고 재시작하세요. 모델별 줄이 안 보이면, `claude -p /usage`는 요금제에 있는 한도만 `Current week (…)` 줄로 출력하고 API 키 로그인에는 출력하지 않습니다. 새로고침에서 `/usage`를 읽지 못하면 알림이 뜹니다.

**참고**: 컨텍스트 수치는 Claude Code 상태줄 기준이라 팝업 숫자와 다를 수 있습니다. 재설정 시각이 지난 한도는 다음에 읽을 때까지 `재설정됨`으로 표시합니다.

## Development

```
claude plugin validate .
claude plugin test .
```

Built on Claude Code's function-hook plugins (early access), tested with Claude Code 2.1.286 (desktop app) and 2.1.288.
