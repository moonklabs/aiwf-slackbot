# 🚀 빠른 시작 가이드

Claude-Gemini Slack 봇을 처음 설정하는 분들을 위한 가이드입니다.

## 📋 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Git
- Slack 워크스페이스 관리자 권한
- Claude Code CLI (선택사항)
- Gemini CLI (선택사항)

## 🛠️ 설치 단계

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/claude-gemini-slackbot.git
cd claude-gemini-slackbot
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Slack 앱 생성

#### 3.1 Slack API 페이지에서 앱 생성

1. [api.slack.com/apps](https://api.slack.com/apps) 접속
2. "Create New App" 클릭
3. "From scratch" 선택
4. 앱 이름: `Claude-Gemini Bot`
5. 워크스페이스 선택

#### 3.2 Socket Mode 활성화

1. 좌측 메뉴에서 "Socket Mode" 클릭
2. "Enable Socket Mode" 토글 켜기
3. 토큰 이름: `SocketMode`
4. 생성된 App-Level Token 복사 → `SLACK_APP_TOKEN`

#### 3.3 봇 권한 설정

1. 좌측 메뉴에서 "OAuth & Permissions" 클릭
2. "Bot Token Scopes"에 다음 권한 추가:
   - `app_mentions:read` - 멘션 읽기
   - `chat:write` - 메시지 전송
   - `commands` - 슬래시 명령어
   - `im:history` - DM 히스토리
   - `im:read` - DM 읽기
   - `im:write` - DM 쓰기
   - `channels:history` - 채널 히스토리
   - `channels:read` - 채널 정보 읽기
   - `groups:history` - 비공개 채널 히스토리
   - `groups:read` - 비공개 채널 읽기

3. 페이지 상단의 "Install to Workspace" 클릭
4. 권한 승인
5. 생성된 Bot User OAuth Token 복사 → `SLACK_BOT_TOKEN`

#### 3.4 이벤트 구독 설정

1. 좌측 메뉴에서 "Event Subscriptions" 클릭
2. "Enable Events" 토글 켜기
3. "Subscribe to bot events"에 추가:
   - `app_mention` - 앱 멘션
   - `message.channels` - 채널 메시지
   - `message.groups` - 비공개 채널 메시지
   - `message.im` - DM 메시지

#### 3.5 슬래시 명령어 설정

1. 좌측 메뉴에서 "Slash Commands" 클릭
2. "Create New Command" 클릭
3. 다음 명령어들 추가:

**Claude 명령어:**
- Command: `/claude`
- Request URL: `https://your-bot-url/slack/events`
- Short Description: `Claude AI와 대화하기`
- Usage Hint: `[agent-name] <message>`

**Gemini 명령어:**
- Command: `/gemini`
- Request URL: `https://your-bot-url/slack/events`
- Short Description: `Gemini AI와 대화하기`
- Usage Hint: `[agent-name] <message>`

#### 3.6 Basic Information에서 Signing Secret 복사

1. 좌측 메뉴에서 "Basic Information" 클릭
2. "App Credentials"에서 Signing Secret 표시
3. 값 복사 → `SLACK_SIGNING_SECRET`

### 4. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env
```

`.env` 파일 편집:
```env
# Slack 필수 설정
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# 선택 설정
PORT=3000
LOG_LEVEL=info
WORKSPACE_DIR=./workspace
COMMAND_TIMEOUT=600000

# Claude/Gemini CLI 경로 (설치된 경우)
CLAUDE_CODE_PATH=claude
GEMINI_CLI_PATH=gemini
```

### 5. 애플리케이션 실행

#### 개발 모드
```bash
npm run dev
```

#### 프로덕션 모드
```bash
npm run build
npm start
```

### 6. 봇 테스트

1. Slack 워크스페이스에서 봇을 채널에 초대:
   ```
   /invite @Claude-Gemini Bot
   ```

2. 첫 명령어 실행:
   ```
   /claude 안녕하세요!
   ```

## 🎯 첫 Agent 생성하기

### 1. 공개 Repository로 Agent 생성

```
/claude create https://github.com/facebook/react main react-study
```

### 2. Agent 확인

```
/claude list
```

### 3. Agent 사용

```
/claude react-study "이 프로젝트의 주요 기능을 설명해줘"
```

## 🐳 Docker로 실행하기 (선택사항)

### 1. Docker 이미지 빌드

```bash
docker build -t claude-gemini-slackbot .
```

### 2. Docker Compose로 실행

```bash
docker-compose up -d
```

## 🔍 문제 해결

### 봇이 응답하지 않음

1. **환경 변수 확인**
   ```bash
   npm run dev
   ```
   시작 시 에러 메시지 확인

2. **Socket Mode 연결 확인**
   - 로그에서 "⚡️ Slack 봇이 실행 중입니다!" 메시지 확인

3. **봇 권한 확인**
   - Slack 앱 설정에서 필요한 권한이 모두 추가되었는지 확인

### Agent 생성 실패

1. **Git 설치 확인**
   ```bash
   git --version
   ```

2. **디렉토리 권한 확인**
   ```bash
   ls -la workspace/
   ```

3. **네트워크 연결 확인**
   - Repository URL에 접근 가능한지 확인

### 명령어가 인식되지 않음

1. **슬래시 명령어 설정 확인**
   - Slack 앱 설정에서 명령어가 올바르게 등록되었는지 확인

2. **봇이 채널에 있는지 확인**
   - 채널 멤버 목록에서 봇 확인

## 📚 다음 단계

1. [Slack 사용 가이드](./SLACK_USAGE.md) - 상세한 사용법
2. [Docker 설정 가이드](./DOCKER_SETUP.md) - Docker 환경 구축
3. [CLAUDE.md](../CLAUDE.md) - 개발자 가이드

## 💡 유용한 팁

1. **로그 레벨 조정**
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

2. **workspace 디렉토리 초기화**
   ```bash
   rm -rf workspace/agents/*
   ```

3. **봇 재시작 없이 설정 변경**
   - 대부분의 설정은 재시작이 필요하지만, Agent는 동적으로 관리됨

## 🆘 도움말 및 지원

- GitHub Issues: [프로젝트 이슈](https://github.com/your-username/claude-gemini-slackbot/issues)
- Slack 커뮤니티: [참여하기](https://your-slack-community.slack.com)

## 🎉 축하합니다!

이제 Claude-Gemini Slack 봇이 실행 중입니다. Agent 시스템을 활용하여 팀의 생산성을 높여보세요!