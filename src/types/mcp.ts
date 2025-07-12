// MCP 관련 타입 정의

export interface MCPSession {
  id: string;
  userId: string;
  agentId?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface MCPTransportConfig {
  type: 'stdio' | 'http' | 'sse';
  options?: {
    port?: number;
    host?: string;
  };
}

export interface MCPToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MCPStreamEvent {
  type: 'output' | 'error' | 'status' | 'complete';
  data: string;
  timestamp: Date;
}

export interface MCPAgentContext {
  agentId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  sessionId?: string;
}