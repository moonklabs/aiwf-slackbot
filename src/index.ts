import { App } from '@slack/bolt';
import { validateConfig, Config } from './utils/config';
import { logger } from './utils/logger';
import { SlackHandler } from './handlers/slackHandler';
import { MCPServer } from './mcp/server';

async function main() {
  let mcpServer: MCPServer | null = null;
  
  try {
    // 설정 검증
    validateConfig();
    logger.info('설정 검증 완료');
    
    // Slack 앱 초기화
    const app = new App({
      token: Config.slack.botToken,
      appToken: Config.slack.appToken,
      signingSecret: Config.slack.signingSecret,
      socketMode: true,
      port: Config.port
    });
    
    // 핸들러 초기화
    const slackHandler = new SlackHandler(app);
    await slackHandler.initialize();
    
    // MCP 서버 시작 (설정된 경우)
    if (process.env.MCP_ENABLED === 'true') {
      mcpServer = new MCPServer();
      const mcpPort = parseInt(process.env.MCP_PORT || '3001');
      await mcpServer.startHttp(mcpPort);
      logger.info(`🚀 MCP 서버가 포트 ${mcpPort}에서 실행 중입니다!`);
    }
    
    // 앱 시작
    await app.start();
    logger.info(`⚡️ Claude-Gemini Slack 봇이 포트 ${Config.port}에서 실행 중입니다!`);
    
    // 프로세스 종료 처리
    const shutdown = async () => {
      logger.info('봇을 종료합니다...');
      
      // MCP 서버 종료
      if (mcpServer) {
        await mcpServer.stop();
      }
      
      // Slack 앱 종료
      await app.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    logger.error('봇 시작 중 오류 발생:', error);
    process.exit(1);
  }
}

// 앱 실행
main();