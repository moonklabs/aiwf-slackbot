import { 
  App, 
  SlashCommand, 
  SlackCommandMiddlewareArgs,
  GenericMessageEvent
} from '@slack/bolt';
import { CommandExecutor } from '../services/commandExecutor';
import { logger } from '../utils/logger';
import { AgentType } from '../types';
import { SecurityValidator } from '../utils/security';
import { Config } from '../utils/config';
import { AgentSlackHandler } from './agentSlackHandler';
import { MCPClient } from '../services/mcpClient';

export class SlackHandler {
  private app: App;
  private executor: CommandExecutor;
  private agentHandler: AgentSlackHandler;
  private mcpClient?: MCPClient;
  private mcpEnabled: boolean = false;
  
  constructor(app: App) {
    this.app = app;
    this.executor = new CommandExecutor();
    this.agentHandler = new AgentSlackHandler();
    this.registerHandlers();
  }
  
  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    await this.agentHandler.initialize();
    
    // MCP 서버가 설정된 경우 클라이언트 초기화
    const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001';
    if (process.env.MCP_ENABLED === 'true') {
      try {
        this.mcpClient = new MCPClient({
          baseUrl: mcpUrl,
        });
        this.mcpEnabled = true;
        logger.info('[SlackHandler] MCP client initialized');
      } catch (error) {
        logger.error('[SlackHandler] Failed to initialize MCP client:', error);
      }
    }
  }
  
  private registerHandlers() {
    // /claude 명령어 처리
    this.app.command('/claude', this.handleClaudeCommand.bind(this));
    
    // /gemini 명령어 처리
    this.app.command('/gemini', this.handleGeminiCommand.bind(this));
    
    // 메시지 이벤트 처리 (멘션된 경우)
    this.app.event('app_mention', async ({ event, client, say }) => {
      await this.handleAppMention({ event, client, say });
    });
    
    // DM 메시지 처리
    this.app.message(async ({ message, client }) => {
      if ('subtype' in message && message.subtype) return;
      if ('bot_id' in message && message.bot_id) return;
      await this.handleDirectMessage({ message: message as GenericMessageEvent, client });
    });
  }
  
  /**
   * /claude 슬래시 명령어 처리
   */
  private async handleClaudeCommand({ 
    command, 
    ack, 
    respond 
  }: SlackCommandMiddlewareArgs & { command: SlashCommand }) {
    await ack();
    
    logger.info('Claude 명령어 수신', { 
      user: command.user_id, 
      text: command.text 
    });
    
    // Agent 관련 명령어 확인
    const args = command.text.trim().split(/\s+/);
    const firstArg = args[0]?.toLowerCase();
    
    if (['create', 'new', 'list', 'ls', 'use', 'select', 'delete', 'rm', 'info', 'update', 'pull'].includes(firstArg)) {
      // Agent 명령어 처리
      await this.agentHandler.handleAgentCommand({ command, ack, respond } as any);
      return;
    }
    
    // Agent를 사용한 명령어 실행 확인 (첫 번째 인자가 Agent 이름/ID일 수 있음)
    if (args.length >= 2 && !firstArg.startsWith('-')) {
      try {
        // Agent 존재 여부 확인을 위해 AgentSlackHandler에 위임
        await this.agentHandler.handleAgentCommand({ command, ack, respond } as any);
        return;
      } catch (error) {
        // Agent가 아닌 경우 일반 명령어로 처리
      }
    }
    
    // 보안 검증
    if (!SecurityValidator.validateCommand(command.text)) {
      await respond({
        text: '❌ 보안상 허용되지 않는 명령어입니다.'
      });
      return;
    }
    
    if (!SecurityValidator.validateInputSize(command.text)) {
      await respond({
        text: '❌ 입력이 너무 깁니다. 더 짧은 명령어를 사용해주세요.'
      });
      return;
    }
    
    await respond({
      text: '🤖 Claude Code를 실행하고 있습니다...'
    });
    
    try {
      // MCP가 활성화된 경우 MCP 사용
      if (this.mcpEnabled && this.mcpClient) {
        await this.executeThroughMCP(command, respond);
      } else {
        // 기존 직접 실행 방식
        const result = await this.executor.executeClaude(command.text);
        
        if (result.success) {
          await respond({
            text: '✅ Claude Code 실행 완료',
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
                    text: `실행 시간: ${result.executionTime}ms`
                  }
                ]
              }
            ]
          });
        } else {
          await respond({
            text: '❌ Claude Code 실행 실패',
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Claude 명령어 처리 오류', error);
      await respond({
        text: `❌ 오류 발생: ${errorMessage}`
      });
    }
  }
  
  /**
   * /gemini 슬래시 명령어 처리
   */
  private async handleGeminiCommand({ 
    command, 
    ack, 
    respond 
  }: SlackCommandMiddlewareArgs & { command: SlashCommand }) {
    await ack();
    
    logger.info('Gemini 명령어 수신', { 
      user: command.user_id, 
      text: command.text 
    });
    
    // 보안 검증
    if (!SecurityValidator.validateCommand(command.text)) {
      await respond({
        text: '❌ 보안상 허용되지 않는 명령어입니다.'
      });
      return;
    }
    
    if (!SecurityValidator.validateInputSize(command.text)) {
      await respond({
        text: '❌ 입력이 너무 깁니다. 더 짧은 명령어를 사용해주세요.'
      });
      return;
    }
    
    await respond({
      text: '🤖 Gemini CLI를 실행하고 있습니다...'
    });
    
    try {
      const result = await this.executor.executeGemini(command.text);
      
      if (result.success) {
        await respond({
          text: '✅ Gemini CLI 실행 완료',
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
                  text: `실행 시간: ${result.executionTime}ms`
                }
              ]
            }
          ]
        });
      } else {
        await respond({
          text: '❌ Gemini CLI 실행 실패',
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gemini 명령어 처리 오류', error);
      await respond({
        text: `❌ 오류 발생: ${errorMessage}`
      });
    }
  }
  
  /**
   * 앱 멘션 처리
   */
  private async handleAppMention({ 
    event, 
    client, 
    say 
  }: { event: any; client: any; say?: any }) {
    logger.info('앱 멘션 수신', { user: event.user, text: event.text });
    
    // 봇 멘션 제거
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // 에이전트 타입 감지
    const agent = this.detectAgent(text);
    
    if (!agent) {
      if (say) {
        await say({
          thread_ts: event.thread_ts || event.ts,
          text: '사용법: `@봇이름 claude <명령어>` 또는 `@봇이름 gemini <명령어>`'
        });
      } else {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts || event.ts,
          text: '사용법: `@봇이름 claude <명령어>` 또는 `@봇이름 gemini <명령어>`'
        });
      }
      return;
    }
    
    await this.executeAndRespond(agent, client, event.channel, event.thread_ts || event.ts);
  }
  
  /**
   * DM 메시지 처리
   */
  private async handleDirectMessage({ 
    message, 
    client 
  }: { 
    message: GenericMessageEvent;
    client: any 
  }) {
    // 이미 처리됨 (message 핸들러에서 필터링)
    
    logger.info('DM 수신', { user: message.user, text: message.text });
    
    const agent = this.detectAgent(message.text || '');
    
    if (!agent) {
      await client.chat.postMessage({
        channel: message.channel,
        text: '사용법: `claude <명령어>` 또는 `gemini <명령어>`'
      });
      return;
    }
    
    if (message.ts) {
      await this.executeAndRespond(agent, client, message.channel, message.ts);
    }
  }
  
  /**
   * 에이전트 타입 감지
   */
  private detectAgent(text: string): AgentType | null {
    const lowerText = text.toLowerCase();
    
    if (lowerText.startsWith('claude ')) {
      return {
        name: 'claude',
        command: Config.claudeCodePath,
        args: [text.substring(7).trim()]
      };
    } else if (lowerText.startsWith('gemini ')) {
      return {
        name: 'gemini',
        command: Config.geminiCliPath,
        args: [text.substring(7).trim()]
      };
    }
    
    return null;
  }
  
  /**
   * 명령어 실행 및 응답
   */
  private async executeAndRespond(
    agent: AgentType, 
    client: any, 
    channel: string, 
    threadTs: string
  ) {
    // 실행 중 메시지
    const runningMsg = await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `🤖 ${agent.name === 'claude' ? 'Claude Code' : 'Gemini CLI'}를 실행하고 있습니다...`
    });
    
    try {
      const result = agent.name === 'claude' 
        ? await this.executor.executeClaude(agent.args[0])
        : await this.executor.executeGemini(agent.args[0]);
      
      // 실행 중 메시지 업데이트
      await client.chat.update({
        channel,
        ts: runningMsg.ts,
        text: result.success ? '✅ 실행 완료' : '❌ 실행 실패',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: result.success 
                ? `*실행 결과:*\n\`\`\`\n${result.output}\n\`\`\``
                : `*오류:*\n\`\`\`\n${result.error}\n\`\`\``
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `실행 시간: ${result.executionTime}ms | 에이전트: ${agent.name}`
              }
            ]
          }
        ]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('명령어 실행 오류', error);
      await client.chat.update({
        channel,
        ts: runningMsg.ts,
        text: `❌ 오류 발생: ${errorMessage}`
      });
    }
  }
  
  /**
   * MCP를 통한 Claude 실행
   */
  private async executeThroughMCP(command: SlashCommand, respond: any) {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }
    
    try {
      // MCP 세션 초기화 (사용자별)
      let session = this.mcpClient.getSession();
      if (!session || session.userId !== command.user_id) {
        session = await this.mcpClient.initialize(command.user_id);
      }
      
      // 기본 Agent 가져오기 또는 생성
      const agents = await this.mcpClient.listAgents(command.user_id);
      let agentId: string;
      
      if (agents.metadata?.agents?.length > 0) {
        // 기본 Agent 사용
        agentId = agents.metadata.agents[0].id;
      } else {
        // 임시 Agent 생성
        await respond({
          text: '⚙️ 기본 Agent를 생성하고 있습니다...'
        });
        
        const newAgent = await this.mcpClient.createAgent(
          command.user_id,
          'https://github.com/moonklabs/default-workspace',
          'main',
          'default'
        );
        agentId = newAgent.metadata.agentId;
      }
      
      // 스트리밍 출력 버퍼
      let outputBuffer = '';
      let lastUpdateTime = Date.now();
      
      // SSE 이벤트 리스너 설정
      this.mcpClient.on('output', async (data: string) => {
        outputBuffer += data;
        
        // 일정 시간마다 또는 버퍼가 충분히 찼을 때 업데이트
        const now = Date.now();
        if (now - lastUpdateTime > 1000 || outputBuffer.length > 1000) {
          await respond({
            text: '🔄 실행 중...',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*실행 중:*\n\`\`\`\n${outputBuffer}\n\`\`\``
                }
              }
            ]
          });
          lastUpdateTime = now;
        }
      });
      
      this.mcpClient.on('error', async (data: string) => {
        await respond({
          text: `⚠️ 오류: ${data}`
        });
      });
      
      // Claude 실행
      const result = await this.mcpClient.executeClaude(agentId, command.text, true);
      
      // 최종 결과 전송
      if (result.metadata?.success) {
        await respond({
          text: '✅ Claude Code 실행 완료 (MCP)',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*실행 결과:*\n\`\`\`\n${result.content[0].text}\n\`\`\``
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `실행 시간: ${result.metadata.executionTime}ms | Agent: ${agentId}`
                }
              ]
            }
          ]
        });
      } else {
        await respond({
          text: '❌ Claude Code 실행 실패 (MCP)',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*오류:*\n\`\`\`\n${result.content[0].text}\n\`\`\``
              }
            }
          ]
        });
      }
      
      // 이벤트 리스너 정리
      this.mcpClient.removeAllListeners('output');
      this.mcpClient.removeAllListeners('error');
      
    } catch (error) {
      logger.error('[SlackHandler] MCP execution error:', error);
      throw error;
    }
  }
}