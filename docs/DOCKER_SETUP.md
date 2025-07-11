# 🐳 Docker 설정 가이드

Claude-Gemini Slack 봇을 Docker로 실행하는 방법을 설명합니다.

## 📋 목차

1. [기본 Docker 설정](#기본-docker-설정)
2. [개발 환경 설정](#개발-환경-설정)
3. [프로덕션 환경 설정](#프로덕션-환경-설정)
4. [Agent별 격리 컨테이너](#agent별-격리-컨테이너)
5. [보안 설정](#보안-설정)
6. [문제 해결](#문제-해결)

## 🚀 기본 Docker 설정

### 1. 단일 컨테이너 실행

#### Dockerfile
```dockerfile
FROM node:18-alpine

# 필수 도구 설치
RUN apk add --no-cache \
    git \
    openssh-client \
    python3 \
    make \
    g++

# Claude와 Gemini CLI 설치 (실제 설치 명령어로 교체)
# RUN npm install -g @anthropic/claude-cli
# RUN npm install -g @google/gemini-cli

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 애플리케이션 파일 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 실행 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["node", "dist/index.js"]
```

#### 빌드 및 실행
```bash
# 이미지 빌드
docker build -t claude-gemini-slackbot .

# 컨테이너 실행
docker run -d \
  --name slackbot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/workspace:/app/workspace \
  claude-gemini-slackbot
```

### 2. Docker Compose 설정

#### docker-compose.yml
```yaml
version: '3.8'

services:
  slackbot:
    build: .
    container_name: claude-gemini-slackbot
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./workspace:/app/workspace
      - agent-data:/app/workspace/agents
    networks:
      - slackbot-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  agent-data:
    driver: local

networks:
  slackbot-network:
    driver: bridge
```

#### 실행 명령어
```bash
# 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

## 🔧 개발 환경 설정

### docker-compose.dev.yml
```yaml
version: '3.8'

services:
  slackbot-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: claude-gemini-slackbot-dev
    ports:
      - "3000:3000"
    env_file:
      - .env.development
    volumes:
      # 소스 코드 마운트 (핫 리로딩)
      - ./src:/app/src
      - ./workspace:/app/workspace
      - /app/node_modules  # node_modules 제외
    command: npm run dev
    networks:
      - slackbot-network
```

### Dockerfile.dev
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

# 개발 도구 설치
COPY package*.json ./
RUN npm install

# nodemon 글로벌 설치
RUN npm install -g nodemon tsx

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

## 🏭 프로덕션 환경 설정

### docker-compose.prod.yml
```yaml
version: '3.8'

services:
  slackbot:
    image: your-registry/claude-gemini-slackbot:latest
    container_name: claude-gemini-slackbot-prod
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    volumes:
      - agent-data:/app/workspace/agents
      - logs:/app/logs
    networks:
      - slackbot-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 옵션: Redis 캐싱
  redis:
    image: redis:7-alpine
    container_name: slackbot-redis
    restart: always
    volumes:
      - redis-data:/data
    networks:
      - slackbot-network

volumes:
  agent-data:
    driver: local
  logs:
    driver: local
  redis-data:
    driver: local

networks:
  slackbot-network:
    driver: bridge
```

### 멀티 스테이지 빌드 Dockerfile
```dockerfile
# 빌드 스테이지
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 프로덕션 스테이지
FROM node:18-alpine

RUN apk add --no-cache git openssh-client tini

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs

# 실행 사용자
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 디렉토리 권한 설정
RUN mkdir -p /app/workspace /app/logs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

## 🔒 Agent별 격리 컨테이너

고급 보안이 필요한 경우, 각 Agent를 독립된 컨테이너에서 실행할 수 있습니다.

### docker-compose.agents.yml
```yaml
version: '3.8'

services:
  slackbot:
    build: .
    container_name: claude-gemini-slackbot-main
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
      - ./workspace:/app/workspace
    networks:
      - slackbot-network
    environment:
      - AGENT_ISOLATION=true

  # Agent 실행을 위한 템플릿 서비스
  agent-template:
    image: claude-gemini-agent:latest
    profiles: ["agent"]  # 수동으로만 시작
    volumes:
      - agent-workspace:/workspace
    networks:
      - agent-network
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/tmp

networks:
  slackbot-network:
    driver: bridge
  agent-network:
    driver: bridge
    internal: true  # 외부 접근 차단
```

### Agent 컨테이너 Dockerfile
```dockerfile
FROM node:18-alpine

# 최소한의 도구만 설치
RUN apk add --no-cache git

# Claude/Gemini CLI 설치
# RUN npm install -g @anthropic/claude-cli @google/gemini-cli

# 보안 설정
RUN addgroup -g 1001 -S agent && \
    adduser -S agent -u 1001

WORKDIR /workspace

USER agent

# 읽기 전용 파일시스템을 위한 설정
ENV NODE_ENV=production
ENV HOME=/tmp

CMD ["sh"]
```

### Agent 컨테이너 동적 생성 스크립트
```typescript
// src/services/dockerAgentManager.ts
import { Docker } from 'dockerode';

export class DockerAgentManager {
  private docker: Docker;
  
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }
  
  async createAgentContainer(agentId: string, gitRepo: string): Promise<string> {
    const container = await this.docker.createContainer({
      Image: 'claude-gemini-agent:latest',
      name: `agent-${agentId}`,
      Env: [
        `GIT_REPO=${gitRepo}`,
        `AGENT_ID=${agentId}`
      ],
      HostConfig: {
        Memory: 1024 * 1024 * 1024, // 1GB
        CpuQuota: 50000, // 50% CPU
        ReadonlyRootfs: true,
        SecurityOpt: ['no-new-privileges'],
        NetworkMode: 'agent-network'
      },
      Labels: {
        'slackbot.agent': 'true',
        'slackbot.agent.id': agentId
      }
    });
    
    await container.start();
    return container.id;
  }
}
```

## 🛡️ 보안 설정

### 1. 환경 변수 보안
```bash
# .env 파일 권한 설정
chmod 600 .env

# Docker secrets 사용 (Swarm 모드)
echo "your-slack-token" | docker secret create slack_bot_token -
```

### 2. 네트워크 격리
```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # 외부 접근 차단
```

### 3. 리소스 제한
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 4. 보안 스캔
```bash
# 이미지 취약점 스캔
docker scan claude-gemini-slackbot:latest

# Trivy 사용
trivy image claude-gemini-slackbot:latest
```

## 📊 모니터링

### docker-compose.monitoring.yml
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    driver: bridge
```

## 🔧 문제 해결

### 1. 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker logs slackbot

# 상세 정보 확인
docker inspect slackbot
```

### 2. 권한 문제
```bash
# workspace 디렉토리 권한
sudo chown -R 1001:1001 ./workspace

# SELinux 컨텍스트 (RHEL/CentOS)
chcon -Rt svirt_sandbox_file_t ./workspace
```

### 3. 네트워크 문제
```bash
# 네트워크 확인
docker network ls
docker network inspect slackbot-network

# 포트 확인
docker port slackbot
```

### 4. 성능 문제
```bash
# 리소스 사용량 확인
docker stats slackbot

# 컨테이너 내부 프로세스 확인
docker top slackbot
```

## 🚀 배포 자동화

### GitHub Actions 예시
```yaml
name: Docker Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/claude-gemini-slackbot:latest
            ${{ secrets.DOCKER_USERNAME }}/claude-gemini-slackbot:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```