import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { ExecutionError } from '../types';

export class RepositoryManager {
  /**
   * Git 명령어 실행
   */
  private async executeGitCommand(
    args: string[], 
    cwd: string,
    timeout: number = 120000 // 2분
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';
      
      const timer = setTimeout(() => {
        git.kill('SIGTERM');
        reject(new Error(`Git 명령어 타임아웃: ${args.join(' ')}`));
      }, timeout);
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git 명령어 실패 (${code}): ${stderr || stdout}`));
        }
      });
      
      git.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  
  /**
   * Repository 클론
   */
  async cloneRepository(
    gitUrl: string, 
    targetDir: string, 
    branch?: string
  ): Promise<void> {
    logger.info(`Repository 클론: ${gitUrl} -> ${targetDir}`);
    
    // 대상 디렉토리가 이미 존재하는지 확인
    try {
      await fs.access(targetDir);
      throw new ExecutionError('대상 디렉토리가 이미 존재합니다', 'DIR_EXISTS');
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
    
    // 부모 디렉토리 생성
    const parentDir = path.dirname(targetDir);
    await fs.mkdir(parentDir, { recursive: true });
    
    try {
      // git clone 실행
      const args = ['clone'];
      if (branch) {
        args.push('-b', branch);
      }
      args.push('--depth', '1'); // shallow clone으로 속도 향상
      args.push(gitUrl, targetDir);
      
      await this.executeGitCommand(args, parentDir);
      
      logger.info(`Repository 클론 완료: ${targetDir}`);
    } catch (error) {
      // 실패 시 디렉토리 정리
      try {
        await fs.rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error('클론 실패 후 정리 중 오류', cleanupError);
      }
      
      throw new ExecutionError(
        `Repository 클론 실패: ${(error as Error).message}`,
        'CLONE_FAILED'
      );
    }
  }
  
  /**
   * Repository 업데이트 (pull)
   */
  async updateRepository(repoDir: string): Promise<void> {
    logger.info(`Repository 업데이트: ${repoDir}`);
    
    // 디렉토리 확인
    try {
      await fs.access(repoDir);
    } catch (error) {
      throw new ExecutionError('Repository 디렉토리를 찾을 수 없습니다', 'DIR_NOT_FOUND');
    }
    
    try {
      // 현재 브랜치 확인
      const { stdout: currentBranch } = await this.executeGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        repoDir
      );
      
      logger.info(`현재 브랜치: ${currentBranch.trim()}`);
      
      // 변경사항 확인
      const { stdout: status } = await this.executeGitCommand(
        ['status', '--porcelain'],
        repoDir
      );
      
      if (status.trim()) {
        // 로컬 변경사항이 있으면 stash
        logger.warn('로컬 변경사항 발견, stash 처리');
        await this.executeGitCommand(['stash', 'push', '-m', 'auto-stash'], repoDir);
      }
      
      // fetch & pull
      await this.executeGitCommand(['fetch', 'origin'], repoDir);
      await this.executeGitCommand(['pull', 'origin', currentBranch.trim()], repoDir);
      
      logger.info('Repository 업데이트 완료');
    } catch (error) {
      throw new ExecutionError(
        `Repository 업데이트 실패: ${(error as Error).message}`,
        'UPDATE_FAILED'
      );
    }
  }
  
  /**
   * 브랜치 전환
   */
  async switchBranch(repoDir: string, branch: string): Promise<void> {
    logger.info(`브랜치 전환: ${branch} (${repoDir})`);
    
    try {
      // 브랜치 목록 업데이트
      await this.executeGitCommand(['fetch', 'origin'], repoDir);
      
      // 로컬 브랜치 확인
      try {
        await this.executeGitCommand(['checkout', branch], repoDir);
      } catch (error) {
        // 원격 브랜치로 새 로컬 브랜치 생성
        await this.executeGitCommand(
          ['checkout', '-b', branch, `origin/${branch}`],
          repoDir
        );
      }
      
      // 최신 상태로 업데이트
      await this.executeGitCommand(['pull', 'origin', branch], repoDir);
      
      logger.info(`브랜치 전환 완료: ${branch}`);
    } catch (error) {
      throw new ExecutionError(
        `브랜치 전환 실패: ${(error as Error).message}`,
        'BRANCH_SWITCH_FAILED'
      );
    }
  }
  
  /**
   * Repository 정보 조회
   */
  async getRepositoryInfo(repoDir: string): Promise<{
    remote: string;
    branch: string;
    lastCommit: string;
    isDirty: boolean;
  }> {
    try {
      // 원격 URL
      const { stdout: remote } = await this.executeGitCommand(
        ['config', '--get', 'remote.origin.url'],
        repoDir
      );
      
      // 현재 브랜치
      const { stdout: branch } = await this.executeGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        repoDir
      );
      
      // 마지막 커밋
      const { stdout: lastCommit } = await this.executeGitCommand(
        ['log', '-1', '--oneline'],
        repoDir
      );
      
      // 변경사항 여부
      const { stdout: status } = await this.executeGitCommand(
        ['status', '--porcelain'],
        repoDir
      );
      
      return {
        remote: remote.trim(),
        branch: branch.trim(),
        lastCommit: lastCommit.trim(),
        isDirty: status.trim().length > 0
      };
    } catch (error) {
      throw new ExecutionError(
        `Repository 정보 조회 실패: ${(error as Error).message}`,
        'INFO_FAILED'
      );
    }
  }
  
  /**
   * Git 설치 여부 확인
   */
  async checkGitInstalled(): Promise<boolean> {
    try {
      await this.executeGitCommand(['--version'], process.cwd(), 5000);
      return true;
    } catch (error) {
      logger.error('Git이 설치되지 않았습니다', error);
      return false;
    }
  }
}