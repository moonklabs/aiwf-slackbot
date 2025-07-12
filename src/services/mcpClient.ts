import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { MCPStreamEvent } from '../types/mcp';

interface MCPClientOptions {
  baseUrl: string;
  timeout?: number;
}

interface MCPSession {
  id: string;
  userId: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    streaming: boolean;
  };
}

export class MCPClient extends EventEmitter {
  private axios: AxiosInstance;
  private session?: MCPSession;
  private sseConnection?: EventSource;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private options: MCPClientOptions) {
    super();
    
    this.axios = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // 세션 초기화
  async initialize(userId: string): Promise<MCPSession> {
    try {
      const response = await this.axios.post('/mcp/initialize', {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          userId,
        },
        id: Date.now(),
      });

      const sessionId = response.headers['mcp-session-id'];
      if (!sessionId) {
        throw new Error('No session ID received');
      }

      this.session = {
        id: sessionId,
        userId,
        capabilities: response.data.result.capabilities,
      };

      // 세션 ID를 헤더에 추가
      this.axios.defaults.headers.common['Mcp-Session-Id'] = sessionId;

      // SSE 연결 시작
      if (this.session.capabilities.streaming) {
        this.connectSSE();
      }

      logger.info(`[MCPClient] Session initialized: ${sessionId}`);
      return this.session;
    } catch (error) {
      logger.error('[MCPClient] Initialization error:', error);
      throw error;
    }
  }

  // SSE 연결
  private connectSSE() {
    if (!this.session) return;

    const sseUrl = `${this.options.baseUrl}/mcp/events`;
    
    // Node.js 환경에서는 EventSource polyfill 필요
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EventSourceModule = require('eventsource');
    const EventSource = EventSourceModule.EventSource || EventSourceModule;
    
    this.sseConnection = new EventSource(sseUrl, {
      headers: {
        'Mcp-Session-Id': this.session.id,
      },
    });

    if (this.sseConnection) {
      this.sseConnection.onopen = () => {
        logger.info('[MCPClient] SSE connection established');
        this.reconnectAttempts = 0;
      };

      this.sseConnection.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleStreamEvent(data);
        } catch (error) {
          logger.error('[MCPClient] SSE message parse error:', error);
        }
      };

      this.sseConnection.onerror = (error: any) => {
        logger.error('[MCPClient] SSE connection error:', error);
        this.reconnectSSE();
      };
    }

    // 이벤트 타입별 핸들러
    if (this.sseConnection) {
      ['output', 'error', 'status', 'complete'].forEach(eventType => {
        this.sseConnection!.addEventListener(eventType, (event: any) => {
          try {
            const data = JSON.parse(event.data) as MCPStreamEvent;
            this.handleStreamEvent(data);
          } catch (error) {
            logger.error(`[MCPClient] ${eventType} event parse error:`, error);
          }
        });
      });
    }
  }

  // SSE 재연결
  private reconnectSSE() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[MCPClient] Max reconnection attempts reached');
      this.emit('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`[MCPClient] Reconnecting SSE in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectSSE();
    }, delay);
  }

  // 스트림 이벤트 처리
  private handleStreamEvent(event: MCPStreamEvent) {
    this.emit('stream', event);
    this.emit(event.type, event.data);
  }

  // Tool 목록 가져오기
  async listTools(): Promise<any[]> {
    const response = await this.request('tools.list', {});
    return response.tools;
  }

  // Resource 목록 가져오기
  async listResources(): Promise<any[]> {
    const response = await this.request('resources.list', {});
    return response.resources;
  }

  // Resource 읽기
  async readResource(uri: string): Promise<any> {
    const response = await this.request('resources.read', { uri });
    return response.contents;
  }

  // Tool 실행
  async callTool(name: string, args: any): Promise<any> {
    const response = await this.request('tools.call', {
      name,
      arguments: args,
    });
    return response;
  }

  // Claude 실행 (편의 메서드)
  async executeClaude(agentId: string, command: string, streaming: boolean = true): Promise<any> {
    return this.callTool('execute_claude', {
      agentId,
      command,
      streaming,
    });
  }

  // Agent 생성 (편의 메서드)
  async createAgent(userId: string, repoUrl: string, branch?: string, name?: string): Promise<any> {
    return this.callTool('create_agent', {
      userId,
      repoUrl,
      branch,
      name,
    });
  }

  // Agent 목록 (편의 메서드)
  async listAgents(userId: string): Promise<any> {
    return this.callTool('list_agents', { userId });
  }

  // Agent 삭제 (편의 메서드)
  async deleteAgent(agentId: string, userId: string): Promise<any> {
    return this.callTool('delete_agent', {
      agentId,
      userId,
    });
  }

  // Agent 업데이트 (편의 메서드)
  async updateAgent(agentId: string, userId: string): Promise<any> {
    return this.callTool('update_agent', {
      agentId,
      userId,
      pullLatest: true,
    });
  }

  // 일반 요청
  private async request(method: string, params: any): Promise<any> {
    if (!this.session) {
      throw new Error('Client not initialized');
    }

    try {
      const response = await this.axios.post('/mcp', {
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'MCP request error');
      }

      return response.data.result;
    } catch (error) {
      logger.error(`[MCPClient] Request error (${method}):`, error);
      throw error;
    }
  }

  // 연결 종료
  async close() {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = undefined;
    }
    
    if (this.session) {
      // 세션 정리 요청 (선택사항)
      try {
        await this.axios.delete(`/mcp/session/${this.session.id}`);
      } catch (error) {
        logger.error('[MCPClient] Session cleanup error:', error);
      }
      
      this.session = undefined;
    }
    
    this.removeAllListeners();
  }

  // 세션 정보 가져오기
  getSession(): MCPSession | undefined {
    return this.session;
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return !!this.session && !!this.sseConnection;
  }
}