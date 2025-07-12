import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { HttpTransport } from './http';
import { logger } from '../../utils/logger';

// HTTP Transport를 MCP Transport로 어댑팅
export class HttpTransportAdapter implements Transport {
  private httpTransport: HttpTransport;
  public sessionId?: string;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  constructor(httpTransport: HttpTransport) {
    this.httpTransport = httpTransport;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // HTTP transport에서 요청을 받으면 MCP 서버로 전달
    this.httpTransport.on('request', (sessionId: string, request: any) => {
      this.sessionId = sessionId;
      
      // JSON-RPC 메시지를 MCP 서버로 전달
      if (this.onmessage) {
        this.onmessage(request);
      }
    });
  }

  // Transport 인터페이스 구현
  async start(): Promise<void> {
    // HTTP 서버는 이미 시작됨
    logger.info('[HttpTransportAdapter] Started');
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    // MCP 서버의 응답을 HTTP 클라이언트로 전송
    this.httpTransport.respond(this.sessionId, message);

    // 스트리밍 이벤트 전송 (필요시)
    if (this.isStreamingMessage(message)) {
      this.httpTransport.broadcast(this.sessionId, {
        type: 'output',
        data: JSON.stringify(message),
        timestamp: new Date(),
      });
    }
  }

  async close(): Promise<void> {
    if (this.onclose) {
      this.onclose();
    }
  }

  private isStreamingMessage(message: any): boolean {
    // 스트리밍이 필요한 메시지 타입 확인
    return message.method?.includes('progress') || 
           message.method?.includes('stream') ||
           false;
  }
}

// 멀티 세션을 지원하는 Transport Factory
export class MultiSessionHttpTransport {
  private httpTransport: HttpTransport;
  private sessions: Map<string, HttpTransportAdapter> = new Map();

  constructor(port: number = 3001) {
    this.httpTransport = new HttpTransport();
    this.setupServer(port);
  }

  private async setupServer(port: number) {
    // HTTP 서버 시작
    await this.httpTransport.listen(port);
    
    // 세션 타임아웃 처리 시작
    this.httpTransport.startSessionCleanup();

    // 새 세션 요청 처리
    this.httpTransport.on('initialize', (sessionId: string) => {
      const adapter = new HttpTransportAdapter(this.httpTransport);
      this.sessions.set(sessionId, adapter);
      logger.info(`[MultiSessionHttpTransport] New session created: ${sessionId}`);
    });
  }

  getTransport(sessionId: string): Transport | undefined {
    return this.sessions.get(sessionId);
  }

  removeSession(sessionId: string) {
    this.sessions.delete(sessionId);
    this.httpTransport.cleanupSession(sessionId);
  }
}