import { AgentManager } from '../src/services/agentManager';
import { RepositoryManager } from '../src/services/repositoryManager';
import fs from 'fs/promises';
import path from 'path';
import { Config } from '../src/utils/config';

// Mock 모듈들
jest.mock('fs/promises');
jest.mock('../src/services/repositoryManager');
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../src/utils/config', () => ({
  Config: {
    workspaceDir: '/test/workspace'
  }
}));

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockRepositoryManager: jest.Mocked<RepositoryManager>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    agentManager = new AgentManager();
    
    // RepositoryManager 모킹
    mockRepositoryManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    (agentManager as any).repositoryManager = mockRepositoryManager;
  });
  
  describe('initialize', () => {
    it('존재하지 않는 파일에서 빈 상태로 시작해야 함', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await agentManager.initialize();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(Config.workspaceDir, 'agents.json'),
        '[]'
      );
    });
    
    it('기존 Agent 데이터를 로드해야 함', async () => {
      const mockAgents = [
        {
          id: 'test-id',
          name: 'test-agent',
          type: 'claude',
          gitRepo: 'https://github.com/test/repo',
          workspaceDir: '/test/workspace/agents/test-id/repo',
          owner: 'U123456',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastUsed: '2024-01-01T00:00:00.000Z',
          status: 'active'
        }
      ];
      
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgents));
      
      await agentManager.initialize();
      
      const agents = await agentManager.listAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('test-agent');
    });
  });
  
  describe('createAgent', () => {
    beforeEach(async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      await agentManager.initialize();
    });
    
    it('새 Agent를 생성해야 함', async () => {
      const gitRepo = 'https://github.com/test/repo';
      mockRepositoryManager.cloneRepository.mockResolvedValue(undefined);
      
      const agent = await agentManager.createAgent('U123456', gitRepo, {
        name: 'my-agent',
        type: 'claude',
        branch: 'main'
      });
      
      expect(agent.name).toBe('my-agent');
      expect(agent.gitRepo).toBe(gitRepo);
      expect(agent.type).toBe('claude');
      expect(agent.owner).toBe('U123456');
      expect(agent.status).toBe('active');
      
      expect(mockRepositoryManager.cloneRepository).toHaveBeenCalledWith(
        gitRepo,
        expect.stringContaining('repo'),
        'main'
      );
    });
    
    it('Repository 클론 실패 시 에러를 처리해야 함', async () => {
      const gitRepo = 'https://github.com/test/repo';
      mockRepositoryManager.cloneRepository.mockRejectedValue(
        new Error('Clone failed')
      );
      (fs.rm as jest.Mock).mockResolvedValue(undefined);
      
      await expect(
        agentManager.createAgent('U123456', gitRepo)
      ).rejects.toThrow('Agent 생성 실패');
    });
  });
  
  describe('getAgent', () => {
    beforeEach(async () => {
      const mockAgents = [
        {
          id: 'test-id-1',
          name: 'agent-1',
          owner: 'U123456',
          type: 'claude',
          gitRepo: 'https://github.com/test/repo1',
          workspaceDir: '/test/workspace/agents/test-id-1/repo',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastUsed: '2024-01-01T00:00:00.000Z',
          status: 'active'
        },
        {
          id: 'test-id-2',
          name: 'agent-2',
          owner: 'U789012',
          type: 'gemini',
          gitRepo: 'https://github.com/test/repo2',
          workspaceDir: '/test/workspace/agents/test-id-2/repo',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastUsed: '2024-01-01T00:00:00.000Z',
          status: 'active'
        }
      ];
      
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgents));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      await agentManager.initialize();
    });
    
    it('ID로 Agent를 찾아야 함', async () => {
      const agent = await agentManager.getAgent('test-id-1');
      expect(agent?.name).toBe('agent-1');
    });
    
    it('이름으로 Agent를 찾아야 함', async () => {
      const agent = await agentManager.getAgent('agent-2', 'U789012');
      expect(agent?.id).toBe('test-id-2');
    });
    
    it('권한이 없는 사용자의 요청을 거부해야 함', async () => {
      await expect(
        agentManager.getAgent('test-id-1', 'U999999')
      ).rejects.toThrow('해당 Agent에 대한 권한이 없습니다');
    });
  });
  
  describe('deleteAgent', () => {
    beforeEach(async () => {
      const mockAgents = [
        {
          id: 'test-id',
          name: 'test-agent',
          owner: 'U123456',
          type: 'claude',
          gitRepo: 'https://github.com/test/repo',
          workspaceDir: '/test/workspace/agents/test-id/repo',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastUsed: '2024-01-01T00:00:00.000Z',
          status: 'active'
        }
      ];
      
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgents));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.rm as jest.Mock).mockResolvedValue(undefined);
      await agentManager.initialize();
    });
    
    it('Agent를 삭제해야 함', async () => {
      await agentManager.deleteAgent('test-id', 'U123456');
      
      const agents = await agentManager.listAgents();
      expect(agents).toHaveLength(0);
      
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('test-id'),
        { recursive: true, force: true }
      );
    });
    
    it('권한이 없는 사용자의 삭제 요청을 거부해야 함', async () => {
      await expect(
        agentManager.deleteAgent('test-id', 'U999999')
      ).rejects.toThrow('해당 Agent에 대한 권한이 없습니다');
    });
  });
});