# 📚 Claude-Gemini Slack Bot 문서

이 디렉토리는 Claude-Gemini Slack Bot의 모든 문서를 포함하고 있습니다.

## 📖 문서 목차

### 1. [빠른 시작 가이드](./QUICK_START.md)
처음 사용자를 위한 단계별 설정 가이드입니다.

- 📋 사전 요구사항
- 🛠️ 설치 단계
  - 저장소 클론
  - 의존성 설치
  - Slack 앱 생성
    - Socket Mode 활성화
    - 봇 권한 설정
    - 이벤트 구독 설정
    - 슬래시 명령어 설정
  - 환경 변수 설정
  - 애플리케이션 실행
- 🎯 첫 Agent 생성하기
- 🐳 Docker로 실행하기
- 🔍 문제 해결
- 💡 유용한 팁

### 2. [Slack 사용 가이드](./SLACK_USAGE.md)
Slack에서 봇을 사용하는 상세한 방법과 예시입니다.

- 🚀 기본 사용법
  - 단순 명령어 실행
  - DM (Direct Message) 사용
  - 채널에서 멘션
- 🤖 Agent 시스템 사용법
  - 새 Agent 생성
  - Agent 목록 확인
  - Agent에서 명령 실행
  - Agent 관리 (정보, 업데이트, 삭제)
- 💡 실제 사용 시나리오
  - 시나리오 1: 새 프로젝트 분석
  - 시나리오 2: 버그 수정 작업
  - 시나리오 3: 팀 협업
- 🛠️ 고급 기능
  - 복잡한 분석 요청
  - 코드 리뷰
  - 문서 생성
- ⚠️ 주의사항
- 🔧 문제 해결
- 💬 팁과 트릭

### 3. [Docker 설정 가이드](./DOCKER_SETUP.md)
Docker를 사용한 배포 및 실행 방법입니다.

- 🚀 기본 Docker 설정
  - 단일 컨테이너 실행
  - Docker Compose 설정
- 🔧 개발 환경 설정
  - docker-compose.dev.yml
  - Dockerfile.dev
- 🏭 프로덕션 환경 설정
  - docker-compose.prod.yml
  - 멀티 스테이지 빌드 Dockerfile
- 🔒 Agent별 격리 컨테이너
  - docker-compose.agents.yml
  - Agent 컨테이너 Dockerfile
  - 동적 컨테이너 생성 스크립트
- 🛡️ 보안 설정
  - 환경 변수 보안
  - 네트워크 격리
  - 리소스 제한
  - 보안 스캔
- 📊 모니터링
  - Prometheus
  - Grafana
  - cAdvisor
- 🔧 문제 해결
- 🚀 배포 자동화

### 4. [개발자 가이드](../CLAUDE.md)
개발자를 위한 기술적인 세부사항입니다.

- 프로젝트 개요
- 주요 명령어
- 프로젝트 구조
- 주요 기능
  - Slack 통합
  - 명령어 실행
  - 보안
  - 멀티 Agent 시스템
- 환경 변수
- Agent 시스템 사용법
- 새 기능 추가 시
- 디버깅

## 🗂️ 추가 문서

### 설정 파일
- [환경 변수 예시](../.env.example)
- [Docker Compose](../docker-compose.yml)
- [Dockerfile](../Dockerfile)
- [개발용 Dockerfile](../Dockerfile.dev)

### 프로젝트 루트
- [README.md](../README.md) - 프로젝트 메인 문서
- [CLAUDE.md](../CLAUDE.md) - Claude AI를 위한 개발 가이드

## 🔍 문서 검색 가이드

### 처음 시작하는 경우
1. [빠른 시작 가이드](./QUICK_START.md)부터 읽어보세요.
2. Slack 앱 설정이 완료되면 [Slack 사용 가이드](./SLACK_USAGE.md)를 참고하세요.

### Docker로 배포하려는 경우
1. [Docker 설정 가이드](./DOCKER_SETUP.md)를 확인하세요.
2. 개발/프로덕션 환경에 맞는 섹션을 선택하세요.

### 기능을 확장하려는 경우
1. [개발자 가이드](../CLAUDE.md)를 읽어보세요.
2. 코드 구조와 아키텍처를 이해한 후 개발을 시작하세요.

## 📝 문서 기여

문서 개선을 위한 기여는 언제나 환영합니다!
- 오타나 잘못된 정보를 발견하면 PR을 보내주세요.
- 더 나은 예시나 설명이 있다면 제안해주세요.
- 새로운 사용 사례를 공유해주세요.

---

최종 업데이트: 2024년 1월