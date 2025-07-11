import { spawn } from 'child_process';
import { CommandResult } from '../types';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';

export class CommandExecutor {
  /**
   * CLI 명령어 실행
   */
  async execute(
    command: string, 
    args: string[], 
    workingDir?: string
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const cwd = workingDir || Config.workspaceDir;
    
    logger.info(`명령어 실행: ${command} ${args.join(' ')}`, { cwd });
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env },
        shell: true
      });
      
      // 타임아웃 설정
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: '명령어 실행 시간 초과',
          executionTime: Date.now() - startTime
        });
      }, Config.commandTimeout);
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        const executionTime = Date.now() - startTime;
        
        if (code === 0) {
          logger.info(`명령어 성공: ${command}`, { executionTime });
          resolve({
            success: true,
            output: stdout,
            executionTime
          });
        } else {
          logger.error(`명령어 실패: ${command}`, { code, stderr });
          resolve({
            success: false,
            output: stdout,
            error: stderr || `프로세스 종료 코드: ${code}`,
            executionTime
          });
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error(`명령어 실행 오류: ${command}`, error);
        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime
        });
      });
    });
  }
  
  /**
   * Claude Code 실행
   */
  async executeClaude(prompt: string, workingDir?: string): Promise<CommandResult> {
    const args = [prompt];
    return this.execute(Config.claudeCodePath, args, workingDir);
  }
  
  /**
   * Gemini CLI 실행
   */
  async executeGemini(prompt: string, workingDir?: string): Promise<CommandResult> {
    const args = [prompt];
    return this.execute(Config.geminiCliPath, args, workingDir);
  }
}