// 명령어 실행 결과
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

// Slack 명령어 요청 타입
export interface SlackCommandRequest {
  command: string;
  text: string;
  user_id: string;
  channel_id: string;
  team_id: string;
  trigger_id: string;
  response_url: string;
}

// AI 에이전트 타입
export interface AgentType {
  name: 'claude' | 'gemini';
  command: string;
  args: string[];
}

// Agent 설정
export interface AgentConfig {
  id: string;
  name: string;
  type: 'claude' | 'gemini';
  gitRepo: string;
  branch?: string;
  workspaceDir: string;
  owner: string; // Slack user ID
  channelId?: string; // 채널별 Agent 관리를 위해
  createdAt: Date;
  lastUsed: Date;
  status: 'active' | 'inactive' | 'initializing' | 'error';
  error?: string; // 에러 메시지 저장용
}

// 에러 타입
export class ExecutionError extends Error {
  constructor(
    message: string, 
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

// 보안 검증 결과
export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
}

// 설정 타입
export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

export interface AppConfig {
  slack: SlackConfig;
  port: number;
  logLevel: string;
  claudeCodePath: string;
  geminiCliPath: string;
  workspaceDir: string;
  commandTimeout: number;
}

// MCP 관련 타입 re-export
export * from './mcp';