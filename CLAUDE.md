# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드입니다.

## 프로젝트 개요

Claude Code와 Gemini CLI를 원격으로 실행할 수 있는 Slack 봇입니다. TypeScript로 작성되었으며 Slack Bolt 프레임워크를 사용합니다.

## 주요 명령어

### 개발
```bash
npm run dev      # 개발 모드로 실행 (파일 변경 감지)
npm run build    # TypeScript 컴파일
npm start        # 프로덕션 모드로 실행
```

### 코드 품질
```bash
npm run lint      # ESLint 실행
npm run typecheck # TypeScript 타입 체크
npm test          # Jest 테스트 실행
```

## 프로젝트 구조

```
src/
├── index.ts               # 앱 진입점
├── handlers/              # Slack 이벤트 핸들러
│   ├── slackHandler.ts    # 기본 Slack 핸들러
│   └── agentSlackHandler.ts # Agent 관련 핸들러
├── services/              # 비즈니스 로직
│   ├── commandExecutor.ts # CLI 명령어 실행
│   ├── agentManager.ts    # Agent 관리
│   └── repositoryManager.ts # Git Repository 관리
├── utils/                 # 유틸리티 함수
│   ├── config.ts          # 환경 설정
│   ├── logger.ts          # Winston 로거
│   └── security.ts        # 보안 검증
└── types/                 # TypeScript 타입 정의
    └── index.ts

workspace/                 # Agent 작업 공간
├── agents.json           # Agent 메타데이터
└── agents/               # Agent별 디렉토리
    └── <agent-id>/
        ├── config.json   # Agent 설정
        └── repo/         # Git repository
```

## 주요 기능

1. **Slack 통합**
   - 슬래시 명령어 (`/claude`, `/gemini`)
   - 앱 멘션 응답
   - DM 지원
   - Socket Mode 사용

2. **명령어 실행**
   - `CommandExecutor` 클래스가 CLI 도구 실행 담당
   - 타임아웃 및 에러 처리
   - 실행 시간 추적

3. **보안**
   - `SecurityValidator` 클래스가 명령어 검증
   - 위험한 명령어 패턴 차단
   - 경로 순회 공격 방지
   - 입력 크기 제한
   - Git Repository URL 검증

4. **멀티 Agent 시스템** (NEW!)
   - Git Repository 기반 독립 실행 환경
   - Agent별 격리된 workspace
   - Repository 자동 클론 및 업데이트
   - 사용자별 Agent 관리

## 환경 변수

필수 환경 변수 (.env 파일):
- `SLACK_BOT_TOKEN` - Slack 봇 토큰
- `SLACK_APP_TOKEN` - Slack 앱 토큰
- `SLACK_SIGNING_SECRET` - Slack 서명 시크릿

선택적 환경 변수:
- `CLAUDE_CODE_PATH` - Claude 실행 경로 (기본: claude)
- `GEMINI_CLI_PATH` - Gemini 실행 경로 (기본: gemini)
- `WORKSPACE_DIR` - 작업 디렉토리 (기본: ./workspace)
- `COMMAND_TIMEOUT` - 실행 타임아웃 (기본: 600000ms)

## Agent 시스템 사용법

### Agent 명령어
- `/claude create <repo-url> [branch] [name]` - 새 Agent 생성
- `/claude list` - 내 Agent 목록 보기
- `/claude use <agent-name>` - 기본 Agent 선택
- `/claude delete <agent-name>` - Agent 삭제
- `/claude info <agent-name>` - Agent 정보 보기
- `/claude update <agent-name>` - Repository 업데이트
- `/claude <agent-name> <명령어>` - 특정 Agent에서 명령 실행

### 사용 예시
```bash
# GitHub repository를 기반으로 새 Agent 생성
/claude create https://github.com/user/my-project main my-agent

# Agent 목록 확인
/claude list

# 특정 Agent에서 명령 실행
/claude my-agent "파일 구조를 분석해줘"

# Repository 최신 버전으로 업데이트
/claude update my-agent
```

## 새 기능 추가 시

1. **새 슬래시 명령어 추가**
   - `slackHandler.ts`에 핸들러 메서드 추가
   - `registerHandlers()`에 등록
   - Slack 앱 설정에서 명령어 추가

2. **새 CLI 도구 지원**
   - `commandExecutor.ts`에 실행 메서드 추가
   - 필요시 환경 변수 추가
   - 보안 검증 로직 확인

3. **테스트 작성**
   - 단위 테스트는 `tests/` 디렉토리에
   - Jest와 ts-jest 사용
   - 보안 관련 기능은 특히 철저히 테스트

4. **Agent 기능 확장**
   - `AgentManager` 클래스에 메서드 추가
   - `AgentSlackHandler`에 명령어 핸들러 추가
   - Repository 관련 작업은 `RepositoryManager` 활용

## 디버깅

로그 레벨 설정:
```bash
LOG_LEVEL=debug npm run dev
```

일반적인 문제:
- 환경 변수 누락 → `validateConfig()` 에러 확인
- 명령어 실행 실패 → CLI 도구 경로 확인
- 봇 응답 없음 → Socket Mode 연결 상태 확인