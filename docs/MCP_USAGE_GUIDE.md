# MCP (Model Context Protocol) 기반 Slack 봇 사용 가이드

이 가이드는 MCP 서버를 활용한 Claude Slack 봇의 설정과 사용 방법을 설명합니다.

## 목차
1. [설정 방법](#1-설정-방법)
2. [기본 사용법](#2-기본-사용법)
3. [Agent 관리](#3-agent-관리)
4. [고급 기능](#4-고급-기능)
5. [문제 해결](#5-문제-해결)

## 1. 설정 방법

### 환경 변수 설정

`.env` 파일에 다음 설정을 추가하세요:

```bash
# Slack 필수 설정
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# MCP 서버 활성화
MCP_ENABLED=true
MCP_PORT=3001
MCP_SERVER_URL=http://localhost:3001

# Claude 경로 설정
CLAUDE_CODE_PATH=claude
WORKSPACE_DIR=./workspace

# 선택 설정
LOG_LEVEL=info
COMMAND_TIMEOUT=600000
```

### 서버 실행

```bash
# 의존성 설치
npm install

# 개발 모드로 실행
npm run dev

# 프로덕션 모드로 실행
npm run build
npm start
```

서버가 성공적으로 실행되면 다음과 같은 로그가 표시됩니다:
```
🚀 MCP 서버가 포트 3001에서 실행 중입니다!
⚡️ Claude-Gemini Slack 봇이 포트 3000에서 실행 중입니다!
```

## 2. 기본 사용법

### 첫 사용 시

MCP가 활성화된 상태에서 처음 Claude를 사용하면 자동으로 기본 Agent가 생성됩니다:

```
/claude 안녕하세요! 오늘 날씨가 어떤가요?
```

**봇 응답:**
```
⚙️ 기본 Agent를 생성하고 있습니다...
🔄 실행 중...
✅ Claude Code 실행 완료 (MCP)

실행 결과:
안녕하세요! 저는 AI 어시스턴트 Claude입니다. 
실제 날씨 정보에 접근할 수는 없지만, 오늘도 좋은 하루 되시길 바랍니다!

실행 시간: 1234ms | Agent: abc123-def456
```

### 일반적인 사용 예시

```
# 코드 작성 요청
/claude Python으로 피보나치 수열을 생성하는 함수를 작성해주세요

# 코드 설명 요청
/claude 이 React 컴포넌트가 어떻게 동작하는지 설명해주세요

# 디버깅 도움 요청
/claude 이 에러 메시지를 해결하는 방법을 알려주세요: TypeError: Cannot read property 'map' of undefined
```

## 3. Agent 관리

Agent는 Git repository 기반의 독립적인 실행 환경입니다. 각 프로젝트별로 Agent를 생성하여 관리할 수 있습니다.

### Agent 생성

```
/claude create <repository-url> [branch] [name]
```

**예시:**
```
# 기본 브랜치(main) 사용
/claude create https://github.com/facebook/react

# 특정 브랜치 지정
/claude create https://github.com/facebook/react v18.2.0 react-v18

# 이름 지정
/claude create https://github.com/mycompany/frontend develop frontend-agent
```

**봇 응답:**
```
✅ Agent가 성공적으로 생성되었습니다!

Agent ID: xyz789-abc123
이름: frontend-agent
Repository: https://github.com/mycompany/frontend
Branch: develop
```

### Agent 목록 확인

```
/claude list
```

**봇 응답:**
```
Agent 목록 (총 3개):

• default (ID: abc123-def456)
  Repository: https://github.com/moonklabs/default-workspace
  상태: active
  마지막 사용: 2024-01-15 10:30:00

• react-v18 (ID: xyz789-abc123)
  Repository: https://github.com/facebook/react
  상태: active
  마지막 사용: 2024-01-15 10:35:00

• frontend-agent (ID: def456-ghi789)
  Repository: https://github.com/mycompany/frontend
  상태: active
  마지막 사용: 2024-01-15 11:00:00
```

### 특정 Agent 사용

Agent 이름을 명령어 앞에 추가하여 특정 Agent를 사용할 수 있습니다:

```
/claude <agent-name> <명령어>
```

**예시:**
```
/claude react-v18 "useState 훅의 내부 구현을 설명해주세요"
/claude frontend-agent "Button 컴포넌트에 로딩 상태를 추가해주세요"
```

### 기본 Agent 설정

자주 사용하는 Agent를 기본으로 설정할 수 있습니다:

```
/claude use <agent-name>
```

**예시:**
```
/claude use frontend-agent
```

이후 Agent 이름을 지정하지 않으면 기본 Agent가 사용됩니다:
```
/claude "테스트 코드 작성해줘"  # frontend-agent가 자동으로 사용됨
```

### Agent 정보 확인

```
/claude info <agent-name>
```

**봇 응답:**
```
Agent 정보:
• 이름: frontend-agent
• ID: def456-ghi789
• Repository: https://github.com/mycompany/frontend
• Branch: develop
• 생성일: 2024-01-15 09:00:00
• 마지막 사용: 2024-01-15 11:00:00
• 상태: active
• 소유자: U123456789
```

### Agent 업데이트

Repository의 최신 변경사항을 가져옵니다:

```
/claude update <agent-name>
```

**봇 응답:**
```
Agent "frontend-agent" (ID: def456-ghi789)가 업데이트되었습니다.
```

### Agent 삭제

```
/claude delete <agent-name>
```

**봇 응답:**
```
Agent "frontend-agent" (ID: def456-ghi789)가 삭제되었습니다.
```

## 4. 고급 기능

### 실시간 스트리밍

긴 작업을 수행할 때 실시간으로 진행 상황을 확인할 수 있습니다:

```
/claude "대규모 프로젝트 구조를 분석하고 개선점을 제안해주세요"
```

봇은 작업 진행 중에 주기적으로 업데이트를 제공합니다:
```
🔄 실행 중...
프로젝트 구조 분석 중...
- 총 파일 수: 1,234개
- 분석 완료: 500개
[계속 업데이트...]
```

### 멀티 Agent 워크플로우

여러 프로젝트를 동시에 관리할 때 유용합니다:

```bash
# 프론트엔드 Agent
/claude create https://github.com/mycompany/frontend main fe-agent

# 백엔드 Agent  
/claude create https://github.com/mycompany/backend main be-agent

# API 문서 Agent
/claude create https://github.com/mycompany/api-docs main docs-agent

# 각 Agent에서 작업 수행
/claude fe-agent "새로운 대시보드 페이지 컴포넌트를 생성해주세요"
/claude be-agent "대시보드 데이터를 제공하는 REST API를 구현해주세요"
/claude docs-agent "위에서 생성한 API의 OpenAPI 스펙을 작성해주세요"
```

### 복잡한 작업 요청

Claude는 여러 단계로 구성된 복잡한 작업도 수행할 수 있습니다:

```
/claude "다음 작업을 순서대로 수행해주세요:
1. 현재 프로젝트의 테스트 커버리지를 확인
2. 커버리지가 70% 미만인 파일들을 찾기
3. 가장 중요한 3개 파일에 대한 단위 테스트 작성
4. 테스트를 실행하고 결과 보고
5. 커버리지가 개선된 정도를 요약"
```

### 코드 리뷰

```
/claude "최근 3개 커밋의 변경사항을 리뷰하고 다음 관점에서 피드백해주세요:
- 코드 품질
- 성능 최적화 가능성
- 보안 취약점
- 테스트 커버리지"
```

### 리팩토링

```
/claude "UserService 클래스를 다음 원칙에 따라 리팩토링해주세요:
- SOLID 원칙 적용
- 의존성 주입 패턴 사용
- 단위 테스트 가능한 구조로 변경"
```

### 문서화

```
/claude "프로젝트의 README.md를 다음 내용을 포함하여 작성해주세요:
- 프로젝트 개요
- 설치 방법
- 사용 방법
- API 문서
- 기여 가이드"
```

## 5. 문제 해결

### MCP 서버 연결 실패

**증상:** "MCP client not initialized" 에러 발생

**해결 방법:**
1. `.env` 파일에서 `MCP_ENABLED=true` 확인
2. MCP_PORT가 사용 가능한지 확인
3. 서버 로그에서 MCP 서버 시작 메시지 확인

### Agent 생성 실패

**증상:** "Failed to clone repository" 에러 발생

**해결 방법:**
1. Repository URL이 올바른지 확인
2. Public repository인지 확인 (Private은 현재 미지원)
3. 브랜치 이름이 정확한지 확인

### 실행 시간 초과

**증상:** "Command execution timeout" 에러 발생

**해결 방법:**
1. `.env`에서 `COMMAND_TIMEOUT` 값을 늘림 (기본: 600000ms = 10분)
2. 작업을 더 작은 단위로 나누어 요청

### 권한 오류

**증상:** "해당 Agent를 수정할 권한이 없습니다"

**해결 방법:**
- Agent는 생성한 사용자만 수정/삭제 가능
- 다른 사용자의 Agent를 사용하려면 복사하여 새로 생성

### 메모리 부족

**증상:** 서버가 느려지거나 응답하지 않음

**해결 방법:**
1. 사용하지 않는 Agent 삭제
2. 서버 재시작
3. `WORKSPACE_DIR` 내 오래된 파일 정리

## 유용한 팁

1. **프로젝트별 Agent 생성**: 각 프로젝트마다 별도의 Agent를 생성하여 독립적인 환경 유지

2. **브랜치 활용**: 개발/스테이징/프로덕션 브랜치별로 Agent를 생성하여 환경별 작업 수행

3. **정기적인 업데이트**: `update` 명령어로 Repository의 최신 변경사항 반영

4. **Agent 이름 규칙**: 프로젝트명-브랜치명 형식으로 일관성 있게 관리 (예: `frontend-dev`, `backend-prod`)

5. **협업 시**: 팀원들과 Agent 이름을 공유하여 일관된 작업 환경 구축

## 보안 주의사항

1. **Public Repository만 사용**: 현재 버전은 public repository만 지원
2. **민감한 정보 주의**: 코드에 포함된 API 키, 비밀번호 등이 노출되지 않도록 주의
3. **명령어 검증**: 시스템은 위험한 명령어를 자동으로 차단하지만, 항상 주의 필요

## 추가 리소스

- [프로젝트 README](../README.md)
- [Slack 사용 가이드](SLACK_USAGE.md)
- [개발자 가이드](../CLAUDE.md)
- [문제 신고](https://github.com/moonklabs/aiwf-slackbot/issues)