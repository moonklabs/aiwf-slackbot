# 상세 설정 가이드

## Slack 앱 생성 및 설정

### 1. Slack 앱 생성

1. [api.slack.com/apps](https://api.slack.com/apps) 접속
2. "Create New App" 클릭
3. "From scratch" 선택
4. 앱 이름과 워크스페이스 선택

### 2. Socket Mode 설정

1. 앱 설정 페이지에서 "Socket Mode" 클릭
2. Socket Mode 활성화
3. 앱 레벨 토큰 생성 (토큰 이름 예: "socket-token")
4. 생성된 토큰을 `SLACK_APP_TOKEN`으로 저장

### 3. OAuth & Permissions 설정

1. "OAuth & Permissions" 메뉴 클릭
2. Bot Token Scopes에 다음 권한 추가:
   - `app_mentions:read` - 앱 멘션 읽기
   - `chat:write` - 메시지 전송
   - `commands` - 슬래시 명령어
   - `im:history` - DM 히스토리 읽기
   - `im:read` - DM 읽기
   - `im:write` - DM 쓰기
3. "Install to Workspace" 클릭
4. 생성된 Bot User OAuth Token을 `SLACK_BOT_TOKEN`으로 저장

### 4. 슬래시 명령어 설정

1. "Slash Commands" 메뉴 클릭
2. "Create New Command" 클릭
3. 다음 명령어들을 추가:

#### /claude 명령어
- Command: `/claude`
- Request URL: `https://your-domain.com/slack/events` (Socket Mode 사용 시 불필요)
- Short Description: Claude Code 실행
- Usage Hint: [명령어 또는 프롬프트]

#### /gemini 명령어
- Command: `/gemini`
- Request URL: `https://your-domain.com/slack/events` (Socket Mode 사용 시 불필요)
- Short Description: Gemini CLI 실행
- Usage Hint: [명령어 또는 프롬프트]

### 5. Event Subscriptions 설정

1. "Event Subscriptions" 메뉴 클릭
2. Enable Events 활성화
3. Subscribe to bot events에 다음 이벤트 추가:
   - `app_mention` - 앱이 멘션될 때
   - `message.im` - DM 메시지를 받을 때

### 6. Basic Information

1. "Basic Information" 메뉴에서 "Signing Secret" 확인
2. 이 값을 `SLACK_SIGNING_SECRET`으로 저장

## Claude Code 및 Gemini CLI 설정

### Claude Code 설치

```bash
# macOS/Linux
curl -fsSL https://claude.ai/install.sh | sh

# 또는 npm으로 설치
npm install -g @anthropic/claude-cli
```

### Gemini CLI 설치

```bash
# npm으로 설치
npm install -g @google/generative-ai-cli

# 또는 직접 다운로드
# https://github.com/google/generative-ai-cli
```

### 경로 확인

설치 후 경로를 확인하고 `.env` 파일에 설정:

```bash
which claude
which gemini
```

## 프로덕션 배포

### 1. PM2 사용

```bash
# PM2 설치
npm install -g pm2

# 앱 시작
pm2 start dist/index.js --name claude-gemini-bot

# 로그 확인
pm2 logs claude-gemini-bot

# 재시작
pm2 restart claude-gemini-bot
```

### 2. Docker 사용

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

### 3. 시스템 서비스 (systemd)

```ini
[Unit]
Description=Claude Gemini Slack Bot
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/claude-gemini-bot
ExecStart=/usr/bin/node /opt/claude-gemini-bot/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 문제 해결

### 봇이 응답하지 않음

1. 환경 변수가 올바르게 설정되었는지 확인
2. Socket Mode가 활성화되어 있는지 확인
3. 봇이 채널에 초대되었는지 확인
4. 로그를 확인하여 오류 메시지 확인

### 명령어 실행 실패

1. Claude Code/Gemini CLI가 설치되어 있는지 확인
2. 실행 권한이 있는지 확인
3. PATH 환경 변수에 포함되어 있는지 확인
4. 작업 디렉토리 권한 확인

### 타임아웃 오류

`.env` 파일에서 `COMMAND_TIMEOUT` 값을 늘려보세요:

```env
COMMAND_TIMEOUT=1200000  # 20분
```