import { logger } from './logger';
import path from 'path';
import { Config } from './config';

/**
 * 명령어 보안 검증
 */
export class SecurityValidator {
  // 금지된 명령어 패턴
  private static readonly FORBIDDEN_PATTERNS = [
    /rm\s+-rf\s+\//,           // 루트 디렉토리 삭제
    /chmod\s+777/,             // 과도한 권한 부여
    /sudo/,                    // sudo 명령어
    /\|[\s]*nc\s+/,           // netcat 파이프
    /curl\s+[^\s]+\s*\|\s*sh/, // curl | sh 패턴
    /eval\s*\(/,              // eval 함수
    /exec\s*\(/,              // exec 함수
  ];
  
  // 허용된 작업 디렉토리 외부 접근 차단
  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//,                  // 상위 디렉토리 접근
    /~\//,                     // 홈 디렉토리 접근
    /^\//,                     // 절대 경로
  ];
  
  /**
   * 명령어 보안 검증
   */
  static validateCommand(command: string): boolean {
    // 금지된 패턴 검사
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(command)) {
        logger.warn('금지된 명령어 패턴 감지', { command, pattern: pattern.source });
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 경로 보안 검증
   */
  static validatePath(filePath: string): boolean {
    // 경로 순회 공격 검사
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filePath)) {
        logger.warn('잠재적 경로 순회 공격 감지', { path: filePath });
        return false;
      }
    }
    
    // 절대 경로로 변환하여 작업 디렉토리 내부인지 확인
    const absolutePath = path.resolve(Config.workspaceDir, filePath);
    const normalizedWorkspace = path.normalize(Config.workspaceDir);
    
    if (!absolutePath.startsWith(normalizedWorkspace)) {
      logger.warn('작업 디렉토리 외부 접근 시도', { 
        path: filePath, 
        resolved: absolutePath 
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * 사용자 권한 검증
   */
  static validateUser(userId: string, allowedUsers?: string[]): boolean {
    if (!allowedUsers || allowedUsers.length === 0) {
      return true; // 제한 없음
    }
    
    const isAllowed = allowedUsers.includes(userId);
    if (!isAllowed) {
      logger.warn('권한 없는 사용자 접근 시도', { userId });
    }
    
    return isAllowed;
  }
  
  /**
   * 입력 크기 제한 검증
   */
  static validateInputSize(input: string, maxSize: number = 10000): boolean {
    if (input.length > maxSize) {
      logger.warn('입력 크기 제한 초과', { 
        size: input.length, 
        maxSize 
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * Git Repository URL 검증
   */
  static validateGitUrl(url: string): boolean {
    // 기본 URL 형식 검증
    try {
      const parsed = new URL(url);
      
      // 허용된 프로토콜
      if (!['http:', 'https:', 'git:', 'ssh:'].includes(parsed.protocol)) {
        logger.warn('허용되지 않은 Git 프로토콜', { protocol: parsed.protocol });
        return false;
      }
      
      // 허용된 호스트 (필요시 확장)
      // const allowedHosts = [
      //   'github.com',
      //   'gitlab.com',
      //   'bitbucket.org',
      //   'git.sr.ht'
      // ];
      
      // SSH 형식 처리 (git@github.com:user/repo.git)
      if (url.includes('git@')) {
        const sshPattern = /^git@([\w.-]+):([\w.-]+)\/([\w.-]+)(\.git)?$/;
        if (!sshPattern.test(url)) {
          logger.warn('잘못된 SSH Git URL 형식', { url });
          return false;
        }
        return true;
      }
      
      // 호스트 검증 (선택적)
      // if (!allowedHosts.includes(parsed.hostname)) {
      //   logger.warn('허용되지 않은 Git 호스트', { host: parsed.hostname });
      //   return false;
      // }
      
      return true;
    } catch (error) {
      // SSH 형식 URL 처리
      if (url.startsWith('git@')) {
        const sshPattern = /^git@([\w.-]+):([\w.-]+)\/([\w.-]+)(\.git)?$/;
        return sshPattern.test(url);
      }
      
      logger.warn('잘못된 Git URL 형식', { url, error });
      return false;
    }
  }
}