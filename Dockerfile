# 빌드 스테이지
FROM node:18-alpine AS builder

# 빌드 도구 설치
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 프로덕션 스테이지
FROM node:18-alpine

# 필수 도구 설치
RUN apk add --no-cache \
    git \
    openssh-client \
    tini \
    # Claude와 Gemini CLI 설치를 위한 준비
    curl \
    bash

# 작업 디렉토리 설정
WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/CLAUDE.md ./CLAUDE.md

# 실행 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# workspace 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/workspace /app/logs && \
    chown -R nodejs:nodejs /app

# Claude와 Gemini CLI 설치 (실제 설치 명령어로 교체 필요)
# RUN npm install -g @anthropic/claude-cli
# RUN npm install -g @google/gemini-cli

# 사용자 전환
USER nodejs

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# tini를 사용하여 프로세스 관리
ENTRYPOINT ["/sbin/tini", "--"]

# 애플리케이션 실행
CMD ["node", "dist/index.js"]