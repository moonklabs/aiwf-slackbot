# 🤖 Claude-Gemini Slack Bot

Slack에서 Claude Code와 Gemini CLI를 실행할 수 있는 강력한 봇입니다. Git Repository 기반의 독립적인 실행 환경(Agent)을 제공하여 프로젝트별로 AI를 활용할 수 있습니다.

[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Slack](https://img.shields.io/badge/Slack-Bolt_Framework-4A154B.svg)](https://slack.dev/bolt-js/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 주요 기능

### 🎯 AI 통합
- **Claude Code**: Anthropic의 Claude를 통한 코드 생성 및 분석
- **Gemini CLI**: Google의 Gemini를 통한 AI 지원
- **멀티 모델 지원**: 작업에 따라 적절한 AI 선택 가능

### 🚀 Agent 시스템 (NEW!)
- **Git Repository 기반**: 각 프로젝트를 독립된 환경에서 실행
- **브랜치 지원**: 특정 브랜치에서 작업 가능
- **자동 업데이트**: Repository의 최신 변경사항 반영
- **격리된 실행**: Agent별 독립적인 workspace

### 🔒 보안
- **명령어 검증**: 위험한 명령어 패턴 차단
- **경로 순회 방지**: 안전한 파일 시스템 접근
- **사용자별 권한**: Agent 소유자만 접근 가능
- **입력 크기 제한**: DoS 공격 방지

### 💬 Slack 통합
- **슬래시 명령어**: `/claude`, `/gemini`
- **DM 지원**: 1:1 대화 가능
- **멘션 응답**: 채널에서 @멘션으로 호출
- **스레드 지원**: 대화 컨텍스트 유지

## 🚀 빠른 시작

### 1. 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/claude-gemini-slackbot.git
cd claude-gemini-slackbot

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 Slack 토큰 설정
```

### 2. Slack 앱 설정

[빠른 시작 가이드](docs/QUICK_START.md)를 참조하여 Slack 앱을 생성하고 설정하세요.

### 3. 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm run build
npm start
```

### 4. Docker로 실행 (선택사항)

```bash
# Docker Compose로 실행
docker-compose up -d
```

자세한 내용은 [Docker 설정 가이드](docs/DOCKER_SETUP.md)를 참조하세요.

## 📖 사용법

### 기본 명령어

```bash
# Claude 사용
/claude 안녕하세요! 코드 리뷰를 도와주세요.

# Gemini 사용
/gemini Python으로 퀵소트 알고리즘을 구현해주세요.
```

### Agent 시스템

```bash
# 새 Agent 생성
/claude create https://github.com/facebook/react main react-agent

# Agent에서 명령 실행
/claude react-agent "useState 훅의 구현을 설명해줘"

# Agent 목록 보기
/claude list

# Agent 업데이트
/claude update react-agent
```

더 많은 예시는 [Slack 사용 가이드](docs/SLACK_USAGE.md)를 참조하세요.

## 📁 프로젝트 구조

```
├── src/
│   ├── handlers/          # Slack 이벤트 핸들러
│   ├── services/          # 비즈니스 로직
│   ├── utils/             # 유틸리티 함수
│   └── types/             # TypeScript 타입 정의
├── tests/                 # 테스트 파일
├── docs/                  # 문서
├── workspace/             # Agent 작업 공간
└── docker/                # Docker 설정 파일
```

## 🛠️ 개발

### 명령어

```bash
npm run dev        # 개발 서버 실행
npm run build      # TypeScript 빌드
npm run lint       # 코드 린팅
npm run typecheck  # 타입 체크
npm test           # 테스트 실행
```

### 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 문서

- [빠른 시작 가이드](docs/QUICK_START.md) - 처음 시작하는 분들을 위한 가이드
- [Slack 사용 가이드](docs/SLACK_USAGE.md) - 상세한 사용법과 예시
- [Docker 설정 가이드](docs/DOCKER_SETUP.md) - Docker 환경 구축
- [개발자 가이드](CLAUDE.md) - 개발 및 확장 가이드

## 🔧 설정

### 필수 환경 변수

| 변수명 | 설명 |
|--------|------|
| `SLACK_BOT_TOKEN` | Slack 봇 OAuth 토큰 |
| `SLACK_APP_TOKEN` | Slack 앱 레벨 토큰 |
| `SLACK_SIGNING_SECRET` | Slack 서명 시크릿 |

### 선택 환경 변수

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PORT` | 3000 | 서버 포트 |
| `LOG_LEVEL` | info | 로그 레벨 |
| `WORKSPACE_DIR` | ./workspace | Agent 작업 디렉토리 |
| `COMMAND_TIMEOUT` | 600000 | 명령어 타임아웃 (ms) |

## 🤝 기여

기여는 언제나 환영합니다! 다음을 참조해주세요:

- [기여 가이드라인](CONTRIBUTING.md)
- [행동 강령](CODE_OF_CONDUCT.md)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 글

- [Slack Bolt Framework](https://slack.dev/bolt-js/)
- [Anthropic Claude](https://www.anthropic.com/)
- [Google Gemini](https://deepmind.google/technologies/gemini/)

## 📞 지원

- 이슈: [GitHub Issues](https://github.com/your-username/claude-gemini-slackbot/issues)
- 토론: [GitHub Discussions](https://github.com/your-username/claude-gemini-slackbot/discussions)

---

Made with ❤️ by [Your Name]