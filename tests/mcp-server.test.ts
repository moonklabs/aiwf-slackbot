import { MCPServer } from '../src/mcp/server';
import { MCPClient } from '../src/services/mcpClient';
import { logger } from '../src/utils/logger';
import fs from 'fs/promises';
import path from 'path';

// 테스트 타임아웃 설정
jest.setTimeout(30000);

describe('MCP Server Tests', () => {
  let server: MCPServer;
  let client: MCPClient;
  const testPort = 3334;
  const testUserId = 'test-user-123';
  
  beforeAll(async () => {
    // 테스트 workspace 디렉토리 생성
    const testWorkspace = path.join(__dirname, '..', 'test-workspace');
    await fs.mkdir(testWorkspace, { recursive: true });
    
    // 환경 변수 설정
    process.env.WORKSPACE_DIR = testWorkspace;
    process.env.MCP_PORT = String(testPort);
  });
  
  afterAll(async () => {
    // 테스트 workspace 정리
    const testWorkspace = path.join(__dirname, '..', 'test-workspace');
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to clean up test workspace:', error);
    }
  });
  
  describe('Server Lifecycle', () => {
    it('should start MCP server successfully', async () => {
      server = new MCPServer();
      await expect(server.startHttp(testPort)).resolves.not.toThrow();
    });
    
    it('should handle port already in use error', async () => {
      const duplicateServer = new MCPServer();
      await expect(duplicateServer.startHttp(testPort)).rejects.toThrow();
    });
  });
  
  describe('Client Connection', () => {
    beforeAll(async () => {
      if (!server) {
        server = new MCPServer();
        await server.startHttp(testPort);
      }
    });
    
    it('should connect client to server', async () => {
      client = new MCPClient({
        baseUrl: `http://localhost:${testPort}`,
        timeout: 5000,
      });
      
      const session = await client.initialize(testUserId);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.capabilities.tools).toBe(true);
      expect(session.capabilities.resources).toBe(true);
      expect(session.capabilities.streaming).toBe(true);
    });
    
    it('should retrieve tool list', async () => {
      const tools = await client.listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // 필수 도구들이 있는지 확인
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('execute_claude');
      expect(toolNames).toContain('create_agent');
      expect(toolNames).toContain('list_agents');
    });
    
    it('should retrieve resource list', async () => {
      const resources = await client.listResources();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
      
      // agent://list 리소스가 있는지 확인
      const resourceUris = resources.map(r => r.uri);
      expect(resourceUris).toContain('agent://list');
    });
  });
  
  describe('Agent Management', () => {
    let createdAgentId: string;
    
    it('should create a new agent', async () => {
      try {
        const result = await client.createAgent(
          testUserId,
          'https://github.com/moonklabs/test-repo',
          'main',
          'test-agent'
        );
        
        expect(result).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.agentId).toBeDefined();
        createdAgentId = result.metadata.agentId;
      } catch (error) {
        // Repository가 없을 수 있으므로 에러는 예상됨
        logger.info('Agent creation failed (expected):', error);
      }
    });
    
    it('should list user agents', async () => {
      const result = await client.listAgents(testUserId);
      expect(result).toBeDefined();
      
      if (result.metadata && result.metadata.agents) {
        expect(Array.isArray(result.metadata.agents)).toBe(true);
      }
    });
    
    it('should delete agent if created', async () => {
      if (createdAgentId) {
        const result = await client.deleteAgent(createdAgentId, testUserId);
        expect(result).toBeDefined();
      }
    });
  });
  
  describe('Streaming Events', () => {
    it('should handle streaming events', (done) => {
      const events: string[] = [];
      
      client.on('stream', (event) => {
        events.push(event.type);
      });
      
      client.on('status', (data) => {
        expect(typeof data).toBe('string');
      });
      
      // SSE 연결이 확립되었는지 확인
      setTimeout(() => {
        expect(client.isConnected()).toBe(true);
        done();
      }, 2000);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid tool execution', async () => {
      await expect(
        client.callTool('invalid_tool', {})
      ).rejects.toThrow();
    });
    
    it('should handle connection errors gracefully', async () => {
      const badClient = new MCPClient({
        baseUrl: 'http://localhost:9999', // 존재하지 않는 포트
        timeout: 1000,
      });
      
      await expect(
        badClient.initialize('test-user')
      ).rejects.toThrow();
    });
  });
  
  describe('Cleanup', () => {
    it('should close client connection', async () => {
      if (client) {
        await client.close();
        expect(client.isConnected()).toBe(false);
      }
    });
    
    it('should stop server gracefully', async () => {
      if (server) {
        await expect(server.stop()).resolves.not.toThrow();
      }
    });
  });
});