import express, { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { MCPSession, MCPStreamEvent } from '../../types/mcp';

// SSE 클라이언트 관리
interface SSEClient {
  id: string;
  response: Response;
  session: MCPSession;
}

export class HttpTransport {
  private app: express.Application;
  private clients: Map<string, SSEClient> = new Map();
  private sessions: Map<string, MCPSession> = new Map();
  private messageQueues: Map<string, any[]> = new Map();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // CORS 설정 (필요시)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });
  }

  private setupRoutes(): void {
    // 세션 초기화
    this.app.post('/mcp/initialize', (req, res) => {
      const sessionId = uuidv4();
      const session: MCPSession = {
        id: sessionId,
        userId: req.body.userId || 'anonymous',
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.sessions.set(sessionId, session);
      this.messageQueues.set(sessionId, []);

      res.setHeader('Mcp-Session-Id', sessionId);
      res.json({
        jsonrpc: '2.0',
        result: {
          sessionId,
          capabilities: {
            tools: true,
            resources: true,
            streaming: true,
          },
        },
        id: req.body.id || null,
      });

      logger.info(`[MCP HTTP] Session initialized: ${sessionId}`);
    });

    // JSON-RPC 요청 처리
    this.app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid or missing session ID',
          },
          id: req.body.id || null,
        });
        return;
      }

      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();

      // 요청을 큐에 추가
      const queue = this.messageQueues.get(sessionId) || [];
      queue.push({
        request: req.body,
        callback: (response: any) => {
          res.json(response);
        },
      });
      this.messageQueues.set(sessionId, queue);

      // 이벤트 발생
      this.emit('request', sessionId, req.body);
    });

    // SSE 엔드포인트
    this.app.get('/mcp/events', (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 비활성화

      const clientId = uuidv4();
      const client: SSEClient = {
        id: clientId,
        response: res,
        session: this.sessions.get(sessionId)!,
      };

      this.clients.set(clientId, client);

      // 초기 연결 메시지
      this.sendEvent(clientId, {
        type: 'status',
        data: 'Connected to MCP server',
        timestamp: new Date(),
      });

      // 클라이언트 연결 종료 처리
      req.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`[MCP HTTP] SSE client disconnected: ${clientId}`);
      });

      // 하트비트 전송 (연결 유지)
      const heartbeat = setInterval(() => {
        if (!this.clients.has(clientId)) {
          clearInterval(heartbeat);
          return;
        }
        
        res.write(':heartbeat\n\n');
      }, 30000);
    });

    // 세션 상태 조회
    this.app.get('/mcp/session/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId;
      const session = this.sessions.get(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      });
    });

    // 세션 삭제
    this.app.delete('/mcp/session/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId;
      const session = this.sessions.get(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // 세션 관련 클라이언트 연결 종료
      Array.from(this.clients.entries())
        .filter(([_, client]) => client.session.id === sessionId)
        .forEach(([clientId, _]) => {
          this.clients.delete(clientId);
        });

      // 세션 삭제
      this.sessions.delete(sessionId);
      this.messageQueues.delete(sessionId);

      res.json({ message: 'Session deleted', sessionId });
    });
  }

  // SSE 이벤트 전송
  private sendEvent(clientId: string, event: MCPStreamEvent): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const data = JSON.stringify(event);
    client.response.write(`event: ${event.type}\n`);
    client.response.write(`data: ${data}\n\n`);
  }

  // 세션의 모든 클라이언트에게 이벤트 전송
  public broadcast(sessionId: string, event: MCPStreamEvent): void {
    const sessionClients = Array.from(this.clients.values())
      .filter(client => client.session.id === sessionId);

    sessionClients.forEach(client => {
      this.sendEvent(client.id, event);
    });
  }

  // 이벤트 리스너 (서버에서 사용)
  private eventHandlers: Map<string, Array<(...args: any[]) => void>> = new Map();

  public on(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  // 응답 처리
  public respond(sessionId: string, response: any): void {
    const queue = this.messageQueues.get(sessionId) || [];
    const request = queue.shift();
    
    if (request) {
      request.callback(response);
      this.messageQueues.set(sessionId, queue);
    }
  }

  // 서버 시작
  public listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port)
        .on('listening', () => {
          logger.info(`[MCP HTTP] Server listening on port ${port}`);
          resolve();
        })
        .on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.error(`[MCP HTTP] Port ${port} is already in use`);
          }
          reject(err);
        });
      
      // 서버 인스턴스 저장 (나중에 종료할 때 사용)
      (this as any).server = server;
    });
  }

  // 서버 종료
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if ((this as any).server) {
        (this as any).server.close(() => {
          logger.info('[MCP HTTP] Server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // 세션 정리
  public cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.messageQueues.delete(sessionId);
    
    // 해당 세션의 모든 클라이언트 연결 종료
    const sessionClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.session.id === sessionId);
    
    sessionClients.forEach(([clientId, client]) => {
      client.response.end();
      this.clients.delete(clientId);
    });
  }

  // 세션 타임아웃 처리
  public startSessionCleanup(timeoutMs: number = 600000): void {
    setInterval(() => {
      const now = Date.now();
      
      this.sessions.forEach((session, sessionId) => {
        const lastActivity = session.lastActivity.getTime();
        if (now - lastActivity > timeoutMs) {
          logger.info(`[MCP HTTP] Session timeout: ${sessionId}`);
          this.cleanupSession(sessionId);
        }
      });
    }, 60000); // 1분마다 체크
  }
}