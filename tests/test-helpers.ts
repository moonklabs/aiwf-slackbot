import { logger } from '../src/utils/logger';

// 포트가 사용 중인지 확인
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

// 사용 가능한 포트 찾기
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await isPortInUse(port)) {
    logger.info(`포트 ${port}가 사용 중입니다. 다음 포트 시도...`);
    port++;
  }
  return port;
}

// 순환 참조 제거를 위한 JSON.stringify 대체
export function safeStringify(obj: any): string {
  const cache = new Set();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
    }
    return value;
  });
}