import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env 파일 로드
config();

export const Config = {
  // Slack 설정
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
  },
  
  // 서버 설정
  port: parseInt(process.env.PORT || '3000', 10),
  
  // 로그 설정
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // CLI 도구 경로
  claudeCodePath: process.env.CLAUDE_CODE_PATH || 'claude',
  geminiCliPath: process.env.GEMINI_CLI_PATH || 'gemini',
  
  // 작업 디렉토리
  workspaceDir: process.env.WORKSPACE_DIR || path.join(process.cwd(), 'workspace'),
  
  // 명령어 실행 타임아웃 (밀리초)
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '600000', 10),
};

// 설정 검증
export function validateConfig(): void {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN',
    'SLACK_SIGNING_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`필수 환경 변수가 누락되었습니다: ${missing.join(', ')}`);
  }
  
  // 작업 디렉토리 생성
  if (!fs.existsSync(Config.workspaceDir)) {
    fs.mkdirSync(Config.workspaceDir, { recursive: true });
  }
}