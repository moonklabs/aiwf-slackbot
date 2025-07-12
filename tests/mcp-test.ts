#!/usr/bin/env ts-node

import { MCPServer } from '../src/mcp/server';
import { MCPClient } from '../src/services/mcpClient';
import { logger } from '../src/utils/logger';

// MCP 서버 통합 테스트
async function testMCPServer() {
  logger.info('=== MCP 서버 통합 테스트 시작 ===');
  
  try {
    // 1. MCP 서버 시작
    logger.info('1. MCP 서버 시작...');
    const server = new MCPServer();
    await server.startHttp(3001);
    
    // 서버 시작 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. MCP 클라이언트 연결
    logger.info('2. MCP 클라이언트 연결...');
    const client = new MCPClient({
      baseUrl: 'http://localhost:3001',
    });
    
    await client.initialize('test-user');
    logger.info('✅ 클라이언트 초기화 성공');
    
    // 3. Tool 목록 조회
    logger.info('3. Tool 목록 조회...');
    const tools = await client.listTools();
    logger.info(`✅ Tool 개수: ${tools.length}`);
    tools.forEach(tool => {
      logger.info(`  - ${tool.name}: ${tool.description}`);
    });
    
    // 4. Resource 목록 조회
    logger.info('4. Resource 목록 조회...');
    const resources = await client.listResources();
    logger.info(`✅ Resource 개수: ${resources.length}`);
    
    // 5. Agent 생성 테스트
    logger.info('5. Agent 생성 테스트...');
    try {
      const agent = await client.createAgent(
        'test-user',
        'https://github.com/moonklabs/test-repo',
        'main',
        'test-agent'
      );
      logger.info('✅ Agent 생성 성공:', agent);
    } catch (error) {
      logger.warn('⚠️ Agent 생성 실패 (예상된 동작):', error);
    }
    
    // 6. Agent 목록 조회
    logger.info('6. Agent 목록 조회...');
    const agents = await client.listAgents('test-user');
    logger.info('✅ Agent 목록:', agents);
    
    // 7. 스트리밍 테스트
    logger.info('7. 스트리밍 이벤트 테스트...');
    
    // 스트리밍 이벤트 리스너 설정
    client.on('output', (data: string) => {
      logger.info(`📤 Output: ${data}`);
    });
    
    client.on('error', (data: string) => {
      logger.error(`❌ Error: ${data}`);
    });
    
    client.on('status', (data: string) => {
      logger.info(`ℹ️ Status: ${data}`);
    });
    
    client.on('complete', (data: string) => {
      logger.info(`✅ Complete: ${data}`);
    });
    
    // 8. 연결 종료
    logger.info('8. 연결 종료...');
    await client.close();
    
    logger.info('=== MCP 서버 통합 테스트 완료 ===');
    process.exit(0);
    
  } catch (error) {
    logger.error('테스트 실패:', error);
    process.exit(1);
  }
}

// 테스트 실행
testMCPServer().catch(error => {
  logger.error('테스트 오류:', error);
  process.exit(1);
});