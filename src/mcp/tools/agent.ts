import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AgentManager } from '../../services/agentManager';
import { RepositoryManager } from '../../services/repositoryManager';
import { logger } from '../../utils/logger';

// Agent 관리 도구들의 입력 스키마
export const CreateAgentSchema = z.object({
  userId: z.string().describe('사용자 ID'),
  repoUrl: z.string().url().describe('Git repository URL'),
  branch: z.string().optional().default('main').describe('Git branch'),
  name: z.string().optional().describe('Agent 이름'),
});

export const ListAgentsSchema = z.object({
  userId: z.string().describe('사용자 ID'),
});

export const DeleteAgentSchema = z.object({
  agentId: z.string().describe('Agent ID'),
  userId: z.string().describe('사용자 ID (권한 확인용)'),
});

export const UpdateAgentSchema = z.object({
  agentId: z.string().describe('Agent ID'),
  userId: z.string().describe('사용자 ID (권한 확인용)'),
  pullLatest: z.boolean().optional().default(true).describe('최신 코드 pull 여부'),
});

export class AgentTools {
  private agentManager: AgentManager;
  private repoManager: RepositoryManager;

  constructor(agentManager: AgentManager, repoManager: RepositoryManager) {
    this.agentManager = agentManager;
    this.repoManager = repoManager;
  }

  // Tool 정의들
  getToolDefinitions(): Tool[] {
    return [
      {
        name: 'create_agent',
        description: '새로운 Agent를 생성합니다',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: '사용자 ID' },
            repoUrl: { type: 'string', description: 'Git repository URL' },
            branch: { type: 'string', description: 'Git branch (기본값: main)' },
            name: { type: 'string', description: 'Agent 이름' },
          },
          required: ['userId', 'repoUrl'],
        },
      },
      {
        name: 'list_agents',
        description: '사용자의 Agent 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: '사용자 ID' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'delete_agent',
        description: 'Agent를 삭제합니다',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            userId: { type: 'string', description: '사용자 ID (권한 확인용)' },
          },
          required: ['agentId', 'userId'],
        },
      },
      {
        name: 'update_agent',
        description: 'Agent의 repository를 업데이트합니다',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            userId: { type: 'string', description: '사용자 ID (권한 확인용)' },
            pullLatest: { type: 'boolean', description: '최신 코드 pull 여부' },
          },
          required: ['agentId', 'userId'],
        },
      },
    ];
  }

  // Agent 생성
  async createAgent(input: z.infer<typeof CreateAgentSchema>) {
    const { userId, repoUrl, branch = 'main', name } = input;

    try {
      logger.info(`[AgentTools] Creating agent for user ${userId}: ${repoUrl}`);

      const agent = await this.agentManager.createAgent(
        userId,
        repoUrl,
        {
          branch,
          name
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: `Agent가 성공적으로 생성되었습니다!\n\nAgent ID: ${agent.id}\n이름: ${agent.name}\nRepository: ${repoUrl}\nBranch: ${branch}`,
          },
        ],
        metadata: {
          agentId: agent.id,
          name: agent.name,
        },
      };
    } catch (error) {
      logger.error('[AgentTools] Create agent error:', error);
      throw error;
    }
  }

  // Agent 목록 조회
  async listAgents(input: z.infer<typeof ListAgentsSchema>) {
    const { userId } = input;

    try {
      const agents = await this.agentManager.listAgents(userId);
      
      if (agents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '생성된 Agent가 없습니다.',
            },
          ],
        };
      }

      const agentList = agents.map((agent: any) => 
        `• ${agent.name} (ID: ${agent.id})\n  Repository: ${agent.gitRepo}\n  상태: ${agent.status}\n  마지막 사용: ${agent.lastUsed.toLocaleString()}`
      ).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Agent 목록 (총 ${agents.length}개):\n\n${agentList}`,
          },
        ],
        metadata: {
          count: agents.length,
          agents: agents.map((a: any) => ({ id: a.id, name: a.name, status: a.status })),
        },
      };
    } catch (error) {
      logger.error('[AgentTools] List agents error:', error);
      throw error;
    }
  }

  // Agent 삭제
  async deleteAgent(input: z.infer<typeof DeleteAgentSchema>) {
    const { agentId, userId } = input;

    try {
      // 권한 확인
      const agent = await this.agentManager.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent를 찾을 수 없습니다.');
      }
      
      if (agent.owner !== userId) {
        throw new Error('해당 Agent를 삭제할 권한이 없습니다.');
      }

      await this.agentManager.deleteAgent(agentId, userId);

      return {
        content: [
          {
            type: 'text',
            text: `Agent "${agent.name}" (ID: ${agentId})가 삭제되었습니다.`,
          },
        ],
      };
    } catch (error) {
      logger.error('[AgentTools] Delete agent error:', error);
      throw error;
    }
  }

  // Agent 업데이트
  async updateAgent(input: z.infer<typeof UpdateAgentSchema>) {
    const { agentId, userId, pullLatest = true } = input;

    try {
      // 권한 확인
      const agent = await this.agentManager.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent를 찾을 수 없습니다.');
      }
      
      if (agent.owner !== userId) {
        throw new Error('해당 Agent를 업데이트할 권한이 없습니다.');
      }

      if (pullLatest) {
        const repoPath = `${agent.workspaceDir}/repo`;
        
        logger.info(`[AgentTools] Updating repository for agent ${agentId}`);
        await this.repoManager.updateRepository(repoPath);
      }

      // Agent 상태 업데이트
      await this.agentManager.updateLastUsed(agentId);

      return {
        content: [
          {
            type: 'text',
            text: `Agent "${agent.name}" (ID: ${agentId})가 업데이트되었습니다.`,
          },
        ],
      };
    } catch (error) {
      logger.error('[AgentTools] Update agent error:', error);
      throw error;
    }
  }
}