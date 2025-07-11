import { App } from '@slack/bolt';
import { validateConfig, Config } from './utils/config';
import { logger } from './utils/logger';
import { SlackHandler } from './handlers/slackHandler';

async function main() {
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
    
    // 앱 시작
    await app.start();
    logger.info(`⚡️ Claude-Gemini Slack 봇이 포트 ${Config.port}에서 실행 중입니다!`);
    
    // 프로세스 종료 처리
    process.on('SIGINT', async () => {
      logger.info('봇을 종료합니다...');
      await app.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('봇 시작 중 오류 발생:', error);
    process.exit(1);
  }
}

// 앱 실행
main();