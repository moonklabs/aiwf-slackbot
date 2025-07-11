import { SlackCommandMiddlewareArgs, SlashCommand } from '@slack/bolt';
import { AgentManager } from '../services/agentManager';
import { CommandExecutor } from '../services/commandExecutor';
import { logger } from '../utils/logger';
import { SecurityValidator } from '../utils/security';
import { AgentConfig } from '../types';

export class AgentSlackHandler {
  private agentManager: AgentManager;
  private executor: CommandExecutor;
  
  constructor() {
    this.agentManager = new AgentManager();
    this.executor = new CommandExecutor();
  }
  
  /**
   * Agent Manager 초기화
   */
  async initialize(): Promise<void> {
    await this.agentManager.initialize();
  }
  
  /**
   * Agent 명령어 파싱 및 라우팅
   */
  async handleAgentCommand({ 
    command, 
    ack, 
    respond 
  }: SlackCommandMiddlewareArgs & { command: SlashCommand }): Promise<void> {
    await ack();
    
    const args = command.text.trim().split(/\s+/);
    const subCommand = args[0]?.toLowerCase();
    
    logger.info('Agent 명령어 수신', { 
      user: command.user_id, 
      subCommand, 
      args 
    });
    
    try {
      switch (subCommand) {
        case 'create':
        case 'new':
          await this.handleCreateAgent(command, args.slice(1), respond);
          break;
          
        case 'list':
        case 'ls':
          await this.handleListAgents(command, respond);
          break;
          
        case 'use':
        case 'select':
          await this.handleUseAgent(command, args.slice(1), respond);
          break;
          
        case 'delete':
        case 'rm':
          await this.handleDeleteAgent(command, args.slice(1), respond);
          break;
          
        case 'info':
          await this.handleAgentInfo(command, args.slice(1), respond);
          break;
          
        case 'update':
        case 'pull':
          await this.handleUpdateAgent(command, args.slice(1), respond);
          break;
          
        default:
          if (args.length >= 2) {
            // /claude agent-name "명령어" 형식 처리
            await this.handleAgentExecution(command, args, respond);
          } else {
            await this.showHelp(respond);
          }
      }
    } catch (error: any) {
      logger.error('Agent 명령어 처리 오류', error);
      await respond({
        text: `❌ 오류 발생: ${error.message}`
      });
    }
  }
  
  /**
   * Agent 생성
   */
  private async handleCreateAgent(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    if (args.length < 1) {
      await respond({
        text: '❌ 사용법: `/claude create <repository-url> [branch] [name]`'
      });
      return;
    }
    
    const [gitRepo, branch, name] = args;
    
    // Repository URL 검증
    if (!SecurityValidator.validateGitUrl(gitRepo)) {
      await respond({
        text: '❌ 유효하지 않은 Git Repository URL입니다.'
      });
      return;
    }
    
    await respond({
      text: '🔄 새로운 Agent를 생성하고 있습니다...'
    });
    
    try {
      const agent = await this.agentManager.createAgent(
        command.user_id,
        gitRepo,
        {
          branch,
          name,
          channelId: command.channel_id,
          type: command.command === '/claude' ? 'claude' : 'gemini'
        }
      );
      
      await respond({
        text: '✅ Agent 생성 완료',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*새 Agent가 생성되었습니다*\n` +
                    `• ID: \`${agent.id}\`\n` +
                    `• 이름: \`${agent.name}\`\n` +
                    `• Repository: ${agent.gitRepo}\n` +
                    `• 브랜치: ${agent.branch || 'main'}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `사용하려면: \`/claude use ${agent.name}\` 또는 \`/claude ${agent.name} <명령어>\``
              }
            ]
          }
        ]
      });
    } catch (error: any) {
      await respond({
        text: `❌ Agent 생성 실패: ${error.message}`
      });
    }
  }
  
  /**
   * Agent 목록 조회
   */
  private async handleListAgents(
    command: SlashCommand,
    respond: any
  ): Promise<void> {
    const agents = await this.agentManager.listAgents(command.user_id);
    
    if (agents.length === 0) {
      await respond({
        text: '📋 생성된 Agent가 없습니다.\n`/claude create <repository-url>`로 새 Agent를 만들어보세요.'
      });
      return;
    }
    
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🤖 내 Agent 목록*'
        }
      }
    ];
    
    for (const agent of agents) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${agent.name}* (${agent.type})\n` +
                `• Repository: ${agent.gitRepo}\n` +
                `• 상태: ${this.getStatusEmoji(agent.status)} ${agent.status}\n` +
                `• 마지막 사용: ${agent.lastUsed.toLocaleString()}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '사용'
          },
          value: agent.id,
          action_id: `use_agent_${agent.id}`
        }
      });
    }
    
    await respond({ blocks });
  }
  
  /**
   * Agent 선택/사용
   */
  private async handleUseAgent(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    if (args.length < 1) {
      await respond({
        text: '❌ 사용법: `/claude use <agent-name|agent-id>`'
      });
      return;
    }
    
    const agentId = args[0];
    const agent = await this.agentManager.getAgent(agentId, command.user_id);
    
    if (!agent) {
      await respond({
        text: '❌ Agent를 찾을 수 없습니다.'
      });
      return;
    }
    
    // 세션에 현재 Agent 저장 (실제 구현에서는 Redis 등 사용)
    // 여기서는 간단히 메모리에 저장
    await respond({
      text: `✅ Agent '${agent.name}'를 선택했습니다.\n이제 \`/claude <명령어>\`로 이 Agent를 사용할 수 있습니다.`
    });
  }
  
  /**
   * Agent 삭제
   */
  private async handleDeleteAgent(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    if (args.length < 1) {
      await respond({
        text: '❌ 사용법: `/claude delete <agent-name|agent-id>`'
      });
      return;
    }
    
    const agentId = args[0];
    
    try {
      await this.agentManager.deleteAgent(agentId, command.user_id);
      await respond({
        text: `✅ Agent가 삭제되었습니다.`
      });
    } catch (error: any) {
      await respond({
        text: `❌ Agent 삭제 실패: ${error.message}`
      });
    }
  }
  
  /**
   * Agent 정보 조회
   */
  private async handleAgentInfo(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    if (args.length < 1) {
      await respond({
        text: '❌ 사용법: `/claude info <agent-name|agent-id>`'
      });
      return;
    }
    
    const agentId = args[0];
    const agent = await this.agentManager.getAgent(agentId, command.user_id);
    
    if (!agent) {
      await respond({
        text: '❌ Agent를 찾을 수 없습니다.'
      });
      return;
    }
    
    await respond({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Agent 정보*\n` +
                  `• ID: \`${agent.id}\`\n` +
                  `• 이름: \`${agent.name}\`\n` +
                  `• 타입: ${agent.type}\n` +
                  `• Repository: ${agent.gitRepo}\n` +
                  `• 브랜치: ${agent.branch || 'main'}\n` +
                  `• 상태: ${this.getStatusEmoji(agent.status)} ${agent.status}\n` +
                  `• 생성일: ${agent.createdAt.toLocaleString()}\n` +
                  `• 마지막 사용: ${agent.lastUsed.toLocaleString()}`
          }
        }
      ]
    });
  }
  
  /**
   * Agent Repository 업데이트
   */
  private async handleUpdateAgent(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    if (args.length < 1) {
      await respond({
        text: '❌ 사용법: `/claude update <agent-name|agent-id>`'
      });
      return;
    }
    
    const agentId = args[0];
    
    await respond({
      text: '🔄 Repository를 업데이트하고 있습니다...'
    });
    
    try {
      await this.agentManager.updateRepository(agentId, command.user_id);
      await respond({
        text: '✅ Repository가 최신 상태로 업데이트되었습니다.'
      });
    } catch (error: any) {
      await respond({
        text: `❌ 업데이트 실패: ${error.message}`
      });
    }
  }
  
  /**
   * Agent를 사용한 명령어 실행
   */
  private async handleAgentExecution(
    command: SlashCommand,
    args: string[],
    respond: any
  ): Promise<void> {
    const [agentId, ...commandArgs] = args;
    const agent = await this.agentManager.getAgent(agentId, command.user_id);
    
    if (!agent) {
      await respond({
        text: '❌ Agent를 찾을 수 없습니다.'
      });
      return;
    }
    
    const userCommand = commandArgs.join(' ');
    
    // 보안 검증
    if (!SecurityValidator.validateCommand(userCommand)) {
      await respond({
        text: '❌ 보안상 허용되지 않는 명령어입니다.'
      });
      return;
    }
    
    await respond({
      text: `🤖 Agent '${agent.name}'에서 ${agent.type === 'claude' ? 'Claude Code' : 'Gemini CLI'}를 실행하고 있습니다...`
    });
    
    try {
      // Agent의 workspace에서 명령어 실행
      const result = agent.type === 'claude'
        ? await this.executor.executeClaude(userCommand, agent.workspaceDir)
        : await this.executor.executeGemini(userCommand, agent.workspaceDir);
      
      // 사용 시간 업데이트
      await this.agentManager.updateLastUsed(agent.id);
      
      if (result.success) {
        await respond({
          text: '✅ 실행 완료',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*실행 결과:*\n\`\`\`\n${result.output}\n\`\`\``
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Agent: ${agent.name} | 실행 시간: ${result.executionTime}ms`
                }
              ]
            }
          ]
        });
      } else {
        await respond({
          text: '❌ 실행 실패',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*오류:*\n\`\`\`\n${result.error}\n\`\`\``
              }
            }
          ]
        });
      }
    } catch (error: any) {
      await respond({
        text: `❌ 명령어 실행 중 오류 발생: ${error.message}`
      });
    }
  }
  
  /**
   * 도움말 표시
   */
  private async showHelp(respond: any): Promise<void> {
    await respond({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🤖 Agent 명령어 도움말*\n\n' +
                  '• `/claude create <repo-url> [branch] [name]` - 새 Agent 생성\n' +
                  '• `/claude list` - 내 Agent 목록 보기\n' +
                  '• `/claude use <agent-name>` - Agent 선택\n' +
                  '• `/claude delete <agent-name>` - Agent 삭제\n' +
                  '• `/claude info <agent-name>` - Agent 정보 보기\n' +
                  '• `/claude update <agent-name>` - Repository 업데이트\n' +
                  '• `/claude <agent-name> <명령어>` - 특정 Agent에서 명령 실행'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '💡 Agent를 사용하면 특정 Git Repository 컨텍스트에서 AI를 실행할 수 있습니다.'
            }
          ]
        }
      ]
    });
  }
  
  /**
   * 상태 이모지 반환
   */
  private getStatusEmoji(status: AgentConfig['status']): string {
    switch (status) {
      case 'active': return '✅';
      case 'inactive': return '💤';
      case 'initializing': return '🔄';
      case 'error': return '❌';
      default: return '❓';
    }
  }
}