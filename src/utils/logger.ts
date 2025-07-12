import winston from 'winston';
import { Config } from './config';

// 순환 참조 제거를 위한 JSON.stringify 대체
function safeStringify(obj: any): string {
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

export const logger = winston.createLogger({
  level: Config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-gemini-slackbot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${safeStringify(meta)}`;
          }
          return log;
        })
      )
    })
  ]
});

// 프로덕션 환경에서는 파일 로깅 추가
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// 개발 환경에서 디버그 정보 출력
if (process.env.NODE_ENV !== 'production') {
  logger.debug('로거 초기화 완료', { 
    logLevel: Config.logLevel,
    environment: process.env.NODE_ENV || 'development'
  });
}