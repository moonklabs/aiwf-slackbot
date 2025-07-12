import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CommandExecutor } from '../../services/commandExecutor';
import { AgentManager } from '../../services/agentManager';
import { logger } from '../../utils/logger';
import { MCPStreamEvent } from '../../types/mcp';

// Claude 실행 도구의 입력 스키마
export const ClaudeToolSchema = z.object({
  agentId: z.string().describe('Agent ID'),
  command: z.string().describe('실행할 명령어'),
  streaming: z.boolean().optional().default(true).describe('스트리밍 출력 여부'),
});

export type ClaudeToolInput = z.infer<typeof ClaudeToolSchema>;

export class ClaudeTool {
  private commandExecutor: CommandExecutor;
  private agentManager: AgentManager;
  private streamCallbacks: Map<string, (event: MCPStreamEvent) => void> = new Map();

  constructor(commandExecutor: CommandExecutor, agentManager: AgentManager) {
    this.commandExecutor = commandExecutor;
    this.agentManager = agentManager;
  }

  // MCP Tool 정의
  getToolDefinition(): Tool {
    return {
      name: 'execute_claude',
      description: 'Claude Code를 실행하고 결과를 반환합니다',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Agent ID',
          },
          command: {
            type: 'string',
            description: '실행할 명령어',
          },
          streaming: {
            type: 'boolean',
            description: '스트리밍 출력 여부',
            default: true,
          },
        },
        required: ['agentId', 'command'],
      },
    };
  }

  // 스트리밍 콜백 등록
  onStream(sessionId: string, callback: (event: MCPStreamEvent) => void) {
    this.streamCallbacks.set(sessionId, callback);
  }

  // 도구 실행
  async execute(input: ClaudeToolInput, sessionId?: string): Promise<any> {
    const { agentId, command, streaming } = input;

    try {
      // Agent 확인
      const agent = await this.agentManager.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // 작업 디렉토리 가져오기
      const workDir = `${agent.workspaceDir}/repo`;
      
      logger.info(`[ClaudeTool] Executing command for agent ${agentId}: ${command}`);

      // 스트리밍 콜백 설정
      const streamCallback = streaming && sessionId ? this.streamCallbacks.get(sessionId) : undefined;

      if (streamCallback) {
        // 시작 이벤트 전송
        streamCallback({
          type: 'status',
          data: `Claude 명령 실행 중: ${command}`,
          timestamp: new Date(),
        });
      }

      // 명령 실행
      const result = await this.commandExecutor.executeClaude(command, workDir);
      
      // 스트리밍 지원은 추후 구현
      if (streamCallback && result.output) {
        streamCallback({
          type: 'output',
          data: result.output,
          timestamp: new Date(),
        });
      }

      if (streamCallback) {
        // 완료 이벤트 전송
        streamCallback({
          type: 'complete',
          data: result.success ? '명령이 성공적으로 완료되었습니다.' : '명령 실행 중 오류가 발생했습니다.',
          timestamp: new Date(),
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: result.output || result.error || '명령이 실행되었습니다.',
          },
        ],
        metadata: {
          success: result.success,
          executionTime: result.executionTime,
          agentId,
        },
      };
    } catch (error) {
      logger.error('[ClaudeTool] Execution error:', error);
      
      const streamCallback = sessionId ? this.streamCallbacks.get(sessionId) : undefined;
      if (streamCallback) {
        streamCallback({
          type: 'error',
          data: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }

      throw error;
    }
  }

  // 세션 정리
  clearSession(sessionId: string) {
    this.streamCallbacks.delete(sessionId);
  }
}