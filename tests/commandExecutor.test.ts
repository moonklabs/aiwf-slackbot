import { CommandExecutor } from '../src/services/commandExecutor';
import { Config } from '../src/utils/config';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// child_process 모듈 모킹
jest.mock('child_process');

// Config 모듈 모킹
jest.mock('../src/utils/config', () => ({
  Config: {
    workspaceDir: '/test/workspace',
    commandTimeout: 5000,
    claudeCodePath: 'claude',
    geminiCliPath: 'gemini'
  }
}));

// logger 모듈 모킹
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

describe('CommandExecutor', () => {
  let executor: CommandExecutor;
  let mockSpawn: jest.MockedFunction<typeof spawn>;
  
  beforeEach(() => {
    executor = new CommandExecutor();
    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    jest.clearAllMocks();
  });
  
  describe('execute', () => {
    it('성공적인 명령어 실행을 처리해야 함', async () => {
      // Mock 프로세스 생성
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      // 비동기 실행을 위한 Promise
      const executePromise = executor.execute('echo', ['hello'], '/test');
      
      // stdout 데이터 전송
      mockProcess.stdout.emit('data', Buffer.from('hello world\n'));
      
      // 프로세스 종료
      mockProcess.emit('close', 0);
      
      const result = await executePromise;
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('hello world\n');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockSpawn).toHaveBeenCalledWith(
        'echo',
        ['hello'],
        expect.objectContaining({
          cwd: '/test',
          shell: true
        })
      );
    });
    
    it('실패한 명령어 실행을 처리해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const executePromise = executor.execute('test-cmd', ['fail']);
      
      // stderr 데이터 전송
      mockProcess.stderr.emit('data', Buffer.from('Command failed\n'));
      
      // 실패 코드로 프로세스 종료
      mockProcess.emit('close', 1);
      
      const result = await executePromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed\n');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
    
    it('타임아웃을 처리해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      // 짧은 타임아웃으로 Config 재설정
      (Config as any).commandTimeout = 100;
      
      const executePromise = executor.execute('sleep', ['10']);
      
      // 타임아웃 대기
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = await executePromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('명령어 실행 시간 초과');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
    
    it('프로세스 실행 오류를 처리해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const executePromise = executor.execute('invalid-cmd', []);
      
      // 프로세스 오류 발생
      mockProcess.emit('error', new Error('Command not found'));
      
      const result = await executePromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command not found');
    });
  });
  
  describe('executeClaude', () => {
    it('Claude 명령어를 올바른 인자로 실행해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const executePromise = executor.executeClaude('test prompt');
      
      mockProcess.stdout.emit('data', Buffer.from('Claude response'));
      mockProcess.emit('close', 0);
      
      const result = await executePromise;
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Claude response');
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['test prompt'],
        expect.objectContaining({
          cwd: Config.workspaceDir
        })
      );
    });
    
    it('사용자 정의 작업 디렉토리를 사용해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const executePromise = executor.executeClaude('test', '/custom/dir');
      
      mockProcess.emit('close', 0);
      
      await executePromise;
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['test'],
        expect.objectContaining({
          cwd: '/custom/dir'
        })
      );
    });
  });
  
  describe('executeGemini', () => {
    it('Gemini 명령어를 올바른 인자로 실행해야 함', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const executePromise = executor.executeGemini('test prompt');
      
      mockProcess.stdout.emit('data', Buffer.from('Gemini response'));
      mockProcess.emit('close', 0);
      
      const result = await executePromise;
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Gemini response');
      expect(mockSpawn).toHaveBeenCalledWith(
        'gemini',
        ['test prompt'],
        expect.objectContaining({
          cwd: Config.workspaceDir
        })
      );
    });
  });
});