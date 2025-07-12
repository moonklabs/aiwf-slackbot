# 📱 Slack 사용 가이드

Claude-Gemini Slack 봇을 Slack에서 사용하는 방법을 상세히 설명합니다.

> **📌 MCP 모드 사용자라면?**  
> MCP(Model Context Protocol) 서버가 활성화된 경우, 더 강력한 기능을 사용할 수 있습니다.  
> 👉 [MCP 사용 가이드](MCP_USAGE_GUIDE.md)를 참고하세요.

## 🚀 기본 사용법

### 1. 단순 명령어 실행

#### Claude 사용
```
/claude 안녕하세요! 제 프로젝트 구조를 분석해주세요.
```

#### Gemini 사용
```
/gemini Python으로 퀵소트 알고리즘을 구현해주세요.
```

### 2. DM (Direct Message) 사용
봇과 1:1 대화에서:
```
claude 오늘 날씨가 어때?
gemini 리액트 훅 사용법을 설명해줘
```

### 3. 채널에서 멘션
```
@claude-bot claude 이 코드의 버그를 찾아줘
@claude-bot gemini 이 함수를 최적화해줘
```

## 🤖 Agent 시스템 사용법

Agent 시스템을 사용하면 특정 Git Repository 컨텍스트에서 AI를 실행할 수 있습니다.

### 1. 새 Agent 생성

#### 기본 생성
```
/claude create https://github.com/myuser/myproject
```

#### 브랜치 지정
```
/claude create https://github.com/myuser/myproject develop my-dev-agent
```

#### 전체 옵션
```
/claude create <repository-url> [branch] [agent-name]
```

**실제 예시:**
```
/claude create https://github.com/facebook/react main react-agent
```

봇 응답:
```
✅ Agent 생성 완료
• ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
• 이름: react-agent
• Repository: https://github.com/facebook/react
• 브랜치: main
사용하려면: /claude use react-agent 또는 /claude react-agent <명령어>
```

### 2. Agent 목록 확인

```
/claude list
```

봇 응답:
```
🤖 내 Agent 목록

react-agent (claude)
• Repository: https://github.com/facebook/react
• 상태: ✅ active
• 마지막 사용: 2024-01-15 14:30:00
[사용] 버튼

my-api (gemini)
• Repository: https://github.com/myuser/my-api
• 상태: ✅ active
• 마지막 사용: 2024-01-15 13:00:00
[사용] 버튼
```

### 3. Agent에서 명령 실행

#### 직접 실행
```
/claude react-agent "useState 훅의 구현을 찾아서 설명해줘"
```

#### Agent 선택 후 사용
```
/claude use react-agent
/claude 이 프로젝트의 테스트 구조를 분석해줘
```

### 4. Agent 관리

#### Agent 정보 확인
```
/claude info react-agent
```

#### Repository 업데이트 (최신 커밋으로)
```
/claude update react-agent
```

#### Agent 삭제
```
/claude delete react-agent
```

## 💡 실제 사용 시나리오

### 시나리오 1: 새 프로젝트 분석

1. **프로젝트 Agent 생성**
   ```
   /claude create https://github.com/vercel/next.js canary nextjs
   ```

2. **프로젝트 구조 파악**
   ```
   /claude nextjs "프로젝트의 전체 구조와 주요 디렉토리를 설명해줘"
   ```

3. **특정 기능 분석**
   ```
   /claude nextjs "라우팅 시스템이 어떻게 구현되어 있는지 분석해줘"
   ```

4. **코드 개선 제안**
   ```
   /claude nextjs "성능 최적화를 위한 개선점을 찾아줘"
   ```

### 시나리오 2: 버그 수정 작업

1. **개발 브랜치 Agent 생성**
   ```
   /claude create https://github.com/myteam/backend feature/user-auth api-dev
   ```

2. **버그 위치 찾기**
   ```
   /claude api-dev "사용자 인증 관련 코드에서 토큰 만료 처리 부분을 찾아줘"
   ```

3. **버그 원인 분석**
   ```
   /claude api-dev "JWT 토큰 검증 로직에 문제가 있는지 확인해줘"
   ```

4. **수정 방안 제시**
   ```
   /claude api-dev "토큰 갱신 로직을 개선하는 코드를 작성해줘"
   ```

### 시나리오 3: 팀 협업

1. **공유 Agent 생성** (팀 채널에서)
   ```
   /claude create https://github.com/team/shared-components main ui-lib
   ```

2. **컴포넌트 사용법 질문**
   ```
   /claude ui-lib "Button 컴포넌트의 모든 props와 사용 예시를 보여줘"
   ```

3. **새 컴포넌트 제안**
   ```
   /claude ui-lib "날짜 선택 컴포넌트를 만들려고 하는데, 기존 스타일 가이드에 맞춰서 구조를 제안해줘"
   ```

## 🛠️ 고급 기능

### 1. 복잡한 분석 요청

```
/claude my-project "다음 작업을 순서대로 진행해줘:
1. 프로젝트의 의존성 분석
2. 사용하지 않는 패키지 찾기
3. 보안 취약점 확인
4. 업데이트가 필요한 패키지 목록"
```

### 2. 코드 리뷰

```
/claude my-project "src/utils/auth.js 파일을 리뷰하고 다음을 확인해줘:
- 보안 취약점
- 성능 개선점
- 코드 스타일 문제
- 테스트 커버리지"
```

### 3. 문서 생성

```
/claude my-api "REST API 엔드포인트를 분석해서 OpenAPI 3.0 스펙 문서를 생성해줘"
```

## ⚠️ 주의사항

1. **Repository 크기**: 매우 큰 Repository는 클론하는데 시간이 걸릴 수 있습니다.
2. **Private Repository**: 현재는 공개 Repository만 지원합니다.
3. **Rate Limiting**: 너무 많은 요청을 연속으로 보내면 일시적으로 제한될 수 있습니다.
4. **보안**: 민감한 정보가 포함된 명령어는 실행하지 마세요.

## 🔧 문제 해결

### Agent 생성 실패
- Git URL이 올바른지 확인
- 브랜치 이름이 정확한지 확인
- Repository가 공개되어 있는지 확인

### 명령 실행 시간 초과
- 더 구체적인 명령어 사용
- 큰 작업은 작은 단위로 나누기

### 봇이 응답하지 않음
- 봇이 채널에 초대되었는지 확인
- 슬래시 명령어가 올바른지 확인
- DM에서는 슬래시(/) 없이 사용

## 💬 팁과 트릭

1. **구체적인 질문**: "이 파일을 분석해줘"보다 "이 파일의 인증 로직을 설명해줘"가 더 좋습니다.

2. **컨텍스트 제공**: Agent를 사용할 때 파일 경로나 함수명을 명시하면 더 정확한 답변을 받을 수 있습니다.

3. **단계별 접근**: 복잡한 작업은 여러 단계로 나누어 진행하세요.

4. **Agent 이름**: 기억하기 쉬운 짧은 이름을 사용하세요.

5. **정기적 업데이트**: Repository가 자주 업데이트되면 `/claude update`를 주기적으로 실행하세요.