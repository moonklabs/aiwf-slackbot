import { App } from '@slack/bolt';
import { SlackHandler } from '../src/handlers/slackHandler';
import { CommandExecutor } from '../src/services/commandExecutor';
import { SecurityValidator } from '../src/utils/security';

// 모듈 모킹
jest.mock('@slack/bolt');
jest.mock('../src/services/commandExecutor');
jest.mock('../src/utils/security');
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('SlackHandler', () => {
  let mockApp: jest.Mocked<App>;
  let mockExecutor: jest.Mocked<CommandExecutor>;
  
  beforeEach(() => {
    // App 모킹
    mockApp = {
      command: jest.fn(),
      event: jest.fn(),
      message: jest.fn()
    } as any;
    
    // CommandExecutor 모킹
    mockExecutor = {
      executeClaude: jest.fn(),
      executeGemini: jest.fn(),
      execute: jest.fn()
    } as any;
    
    (CommandExecutor as jest.MockedClass<typeof CommandExecutor>).mockImplementation(() => mockExecutor);
    
    // SecurityValidator 모킹
    (SecurityValidator.validateCommand as jest.Mock).mockReturnValue(true);
    (SecurityValidator.validateInputSize as jest.Mock).mockReturnValue(true);
    
    // SlackHandler 인스턴스 생성
    new SlackHandler(mockApp);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('registerHandlers', () => {
    it('모든 핸들러를 등록해야 함', () => {
      expect(mockApp.command).toHaveBeenCalledWith('/claude', expect.any(Function));
      expect(mockApp.command).toHaveBeenCalledWith('/gemini', expect.any(Function));
      expect(mockApp.event).toHaveBeenCalledWith('app_mention', expect.any(Function));
      expect(mockApp.message).toHaveBeenCalledWith(expect.any(Function));
    });
  });
  
  describe('handleClaudeCommand', () => {
    let claudeHandler: any;
    let mockAck: jest.Mock;
    let mockRespond: jest.Mock;
    
    beforeEach(() => {
      // /claude 핸들러 함수 추출
      claudeHandler = (mockApp.command as jest.Mock).mock.calls
        .find(call => call[0] === '/claude')[1];
      
      mockAck = jest.fn();
      mockRespond = jest.fn();
    });
    
    it('성공적인 Claude 명령어를 처리해야 함', async () => {
      const command = {
        command: '/claude',
        text: 'test prompt',
        user_id: 'U123456',
        channel_id: 'C123456'
      };
      
      mockExecutor.executeClaude.mockResolvedValue({
        success: true,
        output: 'Claude response',
        executionTime: 1000
      });
      
      await claudeHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockAck).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        text: '🤖 Claude Code를 실행하고 있습니다...'
      });
      expect(mockExecutor.executeClaude).toHaveBeenCalledWith('test prompt');
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '✅ Claude Code 실행 완료',
          blocks: expect.arrayContaining([
            expect.objectContaining({
              type: 'section',
              text: expect.objectContaining({
                text: expect.stringContaining('Claude response')
              })
            })
          ])
        })
      );
    });
    
    it('보안 검증 실패를 처리해야 함', async () => {
      const command = {
        command: '/claude',
        text: 'rm -rf /',
        user_id: 'U123456'
      };
      
      (SecurityValidator.validateCommand as jest.Mock).mockReturnValue(false);
      
      await claudeHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockAck).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        text: '❌ 보안상 허용되지 않는 명령어입니다.'
      });
      expect(mockExecutor.executeClaude).not.toHaveBeenCalled();
    });
    
    it('입력 크기 제한을 검증해야 함', async () => {
      const command = {
        command: '/claude',
        text: 'a'.repeat(10001),
        user_id: 'U123456'
      };
      
      (SecurityValidator.validateCommand as jest.Mock).mockReturnValue(true);
      (SecurityValidator.validateInputSize as jest.Mock).mockReturnValue(false);
      
      await claudeHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockAck).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        text: '❌ 입력이 너무 깁니다. 더 짧은 명령어를 사용해주세요.'
      });
      expect(mockExecutor.executeClaude).not.toHaveBeenCalled();
    });
    
    it('실행 실패를 처리해야 함', async () => {
      const command = {
        command: '/claude',
        text: 'test prompt',
        user_id: 'U123456'
      };
      
      mockExecutor.executeClaude.mockResolvedValue({
        success: false,
        error: 'Execution failed',
        executionTime: 500
      });
      
      await claudeHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '❌ Claude Code 실행 실패',
          blocks: expect.arrayContaining([
            expect.objectContaining({
              type: 'section',
              text: expect.objectContaining({
                text: expect.stringContaining('Execution failed')
              })
            })
          ])
        })
      );
    });
    
    it('예외를 처리해야 함', async () => {
      const command = {
        command: '/claude',
        text: 'test prompt',
        user_id: 'U123456'
      };
      
      mockExecutor.executeClaude.mockRejectedValue(new Error('Unexpected error'));
      
      await claudeHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockRespond).toHaveBeenCalledWith({
        text: '❌ 오류 발생: Unexpected error'
      });
    });
  });
  
  describe('handleGeminiCommand', () => {
    let geminiHandler: any;
    let mockAck: jest.Mock;
    let mockRespond: jest.Mock;
    
    beforeEach(() => {
      // /gemini 핸들러 함수 추출
      geminiHandler = (mockApp.command as jest.Mock).mock.calls
        .find(call => call[0] === '/gemini')[1];
      
      mockAck = jest.fn();
      mockRespond = jest.fn();
    });
    
    it('성공적인 Gemini 명령어를 처리해야 함', async () => {
      const command = {
        command: '/gemini',
        text: 'test prompt',
        user_id: 'U123456'
      };
      
      mockExecutor.executeGemini.mockResolvedValue({
        success: true,
        output: 'Gemini response',
        executionTime: 800
      });
      
      await geminiHandler({ command, ack: mockAck, respond: mockRespond });
      
      expect(mockAck).toHaveBeenCalled();
      expect(mockExecutor.executeGemini).toHaveBeenCalledWith('test prompt');
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '✅ Gemini CLI 실행 완료'
        })
      );
    });
  });
  
  describe('handleAppMention', () => {
    let mentionHandler: any;
    let mockClient: any;
    
    beforeEach(() => {
      // app_mention 핸들러 함수 추출
      mentionHandler = (mockApp.event as jest.Mock).mock.calls
        .find(call => call[0] === 'app_mention')[1];
      
      mockClient = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({ ts: '123.456' }),
          update: jest.fn()
        }
      };
    });
    
    it('Claude 멘션을 처리해야 함', async () => {
      const event = {
        user: 'U123456',
        text: '<@BOT123> claude test prompt',
        channel: 'C123456',
        ts: '123.456'
      };
      
      mockExecutor.executeClaude.mockResolvedValue({
        success: true,
        output: 'Claude response',
        executionTime: 1000
      });
      
      await mentionHandler({ event, client: mockClient });
      
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123456',
          thread_ts: '123.456',
          text: expect.stringContaining('Claude Code')
        })
      );
      expect(mockExecutor.executeClaude).toHaveBeenCalledWith('test prompt');
    });
    
    it('Gemini 멘션을 처리해야 함', async () => {
      const event = {
        user: 'U123456',
        text: '<@BOT123> gemini test prompt',
        channel: 'C123456',
        ts: '123.456'
      };
      
      mockExecutor.executeGemini.mockResolvedValue({
        success: true,
        output: 'Gemini response',
        executionTime: 800
      });
      
      await mentionHandler({ event, client: mockClient });
      
      expect(mockExecutor.executeGemini).toHaveBeenCalledWith('test prompt');
    });
    
    it('잘못된 명령어에 대해 도움말을 표시해야 함', async () => {
      const event = {
        user: 'U123456',
        text: '<@BOT123> invalid command',
        channel: 'C123456',
        ts: '123.456'
      };
      
      await mentionHandler({ event, client: mockClient });
      
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('사용법:')
        })
      );
      expect(mockExecutor.executeClaude).not.toHaveBeenCalled();
      expect(mockExecutor.executeGemini).not.toHaveBeenCalled();
    });
  });
  
  describe('handleDirectMessage', () => {
    let messageHandler: any;
    let mockClient: any;
    
    beforeEach(() => {
      // message 핸들러 함수 추출
      messageHandler = (mockApp.message as jest.Mock).mock.calls[0][0];
      
      mockClient = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({ ts: '123.456' }),
          update: jest.fn()
        }
      };
    });
    
    it('DM에서 Claude 명령어를 처리해야 함', async () => {
      const message = {
        user: 'U123456',
        text: 'claude test prompt',
        channel: 'D123456',
        ts: '123.456'
      };
      
      mockExecutor.executeClaude.mockResolvedValue({
        success: true,
        output: 'Claude response',
        executionTime: 1000
      });
      
      await messageHandler({ message, client: mockClient });
      
      expect(mockExecutor.executeClaude).toHaveBeenCalledWith('test prompt');
    });
    
    it('봇 메시지는 무시해야 함', async () => {
      const message = {
        user: 'U123456',
        text: 'claude test',
        channel: 'D123456',
        bot_id: 'B123456'
      };
      
      await messageHandler({ message, client: mockClient });
      
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
      expect(mockExecutor.executeClaude).not.toHaveBeenCalled();
    });
  });
});