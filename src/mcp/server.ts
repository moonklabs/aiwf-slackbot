import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';
import { AgentManager } from '../services/agentManager';
import { RepositoryManager } from '../services/repositoryManager';
import { CommandExecutor } from '../services/commandExecutor';
import { HttpTransport } from './transports/http';
import { HttpTransportAdapter, MultiSessionHttpTransport } from './transports/httpAdapter';
import { ClaudeTool } from './tools/claude';
import { AgentTools } from './tools/agent';

// MCP 서버 정의
export class MCPServer {
  private server: Server;
  private agentManager: AgentManager;
  private repoManager: RepositoryManager;
  private commandExecutor: CommandExecutor;
  private multiSessionTransport?: MultiSessionHttpTransport;
  private httpTransport?: HttpTransport;
  private claudeTool: ClaudeTool;
  private agentTools: AgentTools;

  constructor(workspaceDir?: string) {
    // 서비스 초기화
    this.agentManager = new AgentManager(workspaceDir);
    this.repoManager = new RepositoryManager();
    this.commandExecutor = new CommandExecutor();
    
    // 도구 초기화
    this.claudeTool = new ClaudeTool(this.commandExecutor, this.agentManager);
    this.agentTools = new AgentTools(this.agentManager, this.repoManager);

    // MCP 서버 생성
    this.server = new Server(
      {
        name: 'aiwf-slackbot-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Tool 목록 제공
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        this.claudeTool.getToolDefinition(),
        ...this.agentTools.getToolDefinitions(),
      ],
    }));

    // Resource 목록 제공
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'agent://list',
          name: 'Agent 목록',
          description: '모든 Agent 목록을 조회합니다',
          mimeType: 'application/json',
        },
      ],
    }));

    // Resource 읽기
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'agent://list') {
        const agents = await this.agentManager.listAgents();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });

    // Tool 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute_claude':
          // sessionId는 request context에서 가져와야 함 (구현 필요)
          return await this.claudeTool.execute(args as any);

        case 'create_agent':
          return await this.agentTools.createAgent(args as any);

        case 'list_agents':
          return await this.agentTools.listAgents(args as any);

        case 'delete_agent':
          return await this.agentTools.deleteAgent(args as any);

        case 'update_agent':
          return await this.agentTools.updateAgent(args as any);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // 에러 핸들링
    this.server.onerror = (error) => {
      logger.error('[MCP Server] Error:', error);
    };
  }

  async start() {
    // STDIO transport로 시작 (테스트용)
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('[MCP Server] Started with STDIO transport');
  }

  async startHttp(port: number = 3001) {
    // HTTP/SSE transport 시작
    this.multiSessionTransport = new MultiSessionHttpTransport(port);
    
    // HTTP transport를 통한 세션별 MCP 서버 처리
    const httpTransport = new HttpTransport();
    
    httpTransport.on('request', async (sessionId: string, request: any) => {
      try {
        // 세션별 transport 가져오기
        let transport = this.multiSessionTransport!.getTransport(sessionId);
        
        if (!transport) {
          // 새 세션인 경우 transport 생성
          transport = new HttpTransportAdapter(httpTransport);
          
          // 새 MCP 서버 인스턴스를 세션별로 생성하거나
          // 기존 서버를 재사용 (현재는 재사용)
          if (transport) {
            await this.server.connect(transport);
          }
        }
        
        // 요청 처리는 transport adapter에서 자동으로 수행됨
      } catch (error) {
        logger.error('[MCP Server] HTTP request error:', error);
        httpTransport.respond(sessionId, {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error',
          },
          id: request.id || null,
        });
      }
    });
    
    await httpTransport.listen(port);
    this.httpTransport = httpTransport;
    logger.info(`[MCP Server] HTTP/SSE transport started on port ${port}`);
  }

  // 서버 종료
  async stop(): Promise<void> {
    if (this.httpTransport) {
      await this.httpTransport.close();
    }
    logger.info('[MCP Server] Stopped');
  }
}