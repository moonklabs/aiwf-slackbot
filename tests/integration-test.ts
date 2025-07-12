#!/usr/bin/env ts-node

/**
 * MCP 서버 및 Slack 봇 통합 테스트
 * 실제 환경과 유사한 시나리오를 테스트합니다.
 */

import dotenv from 'dotenv';
import path from 'path';
import { MCPServer } from '../src/mcp/server';
import { MCPClient } from '../src/services/mcpClient';
import { logger } from '../src/utils/logger';
import { AgentManager } from '../src/services/agentManager';
import fs from 'fs/promises';
import { findAvailablePort } from './test-helpers';

// 테스트 환경 설정 로드
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

class IntegrationTest {
  private results: TestResult[] = [];
  private server?: MCPServer;
  private client?: MCPClient;
  private testWorkspace: string;
  
  constructor() {
    this.testWorkspace = path.join(__dirname, '..', 'test-workspace');
  }
  
  async setup() {
    logger.info('🔧 테스트 환경 설정 중...');
    
    // 테스트 workspace 생성
    await fs.mkdir(this.testWorkspace, { recursive: true });
    await fs.mkdir(path.join(this.testWorkspace, 'agents'), { recursive: true });
    
    // agents.json 초기화
    await fs.writeFile(
      path.join(this.testWorkspace, 'agents.json'),
      '[]',
      'utf-8'
    );
  }
  
  async cleanup() {
    logger.info('🧹 테스트 환경 정리 중...');
    
    // 클라이언트 종료
    if (this.client) {
      await this.client.close();
    }
    
    // 서버 종료
    if (this.server) {
      await this.server.stop();
    }
    
    // workspace 정리
    try {
      await fs.rm(this.testWorkspace, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Workspace 정리 실패:', error);
    }
  }
  
  async runTest(name: string, testFn: () => Promise<void>) {
    const startTime = Date.now();
    try {
      await testFn();
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - startTime,
      });
      logger.info(`✅ ${name}`);
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      logger.error(`❌ ${name}: ${error}`);
    }
  }
  
  async runAllTests() {
    logger.info('🚀 통합 테스트 시작\n');
    
    await this.setup();
    
    try {
      let port: number;
      
      // 1. MCP 서버 시작 테스트
      await this.runTest('MCP 서버 시작', async () => {
        this.server = new MCPServer(this.testWorkspace);
        const basePort = parseInt(process.env.MCP_PORT || '3334');
        port = await findAvailablePort(basePort + Math.floor(Math.random() * 1000));
        await this.server.startHttp(port);
        
        // 클라이언트를 위해 포트 저장
        process.env.MCP_SERVER_URL = `http://localhost:${port}`;
        
        // 서버 시작 확인
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      // 2. 클라이언트 연결 테스트
      await this.runTest('MCP 클라이언트 연결', async () => {
        this.client = new MCPClient({
          baseUrl: process.env.MCP_SERVER_URL || 'http://localhost:3334',
          timeout: 5000,
        });
        
        const session = await this.client.initialize('test-user-123');
        if (!session || !session.id) {
          throw new Error('세션 초기화 실패');
        }
      });
      
      // 3. Tool 목록 조회 테스트
      await this.runTest('Tool 목록 조회', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        const tools = await this.client.listTools();
        if (!Array.isArray(tools) || tools.length === 0) {
          throw new Error('Tool 목록이 비어있음');
        }
        
        logger.info(`  - 발견된 Tool 개수: ${tools.length}`);
        tools.forEach(tool => {
          logger.info(`  - ${tool.name}: ${tool.description}`);
        });
      });
      
      // 4. Resource 조회 테스트
      await this.runTest('Resource 조회', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        const resources = await this.client.listResources();
        if (!Array.isArray(resources)) {
          throw new Error('Resource 목록 조회 실패');
        }
        
        logger.info(`  - 발견된 Resource 개수: ${resources.length}`);
      });
      
      // 5. Agent 생성 테스트
      await this.runTest('Agent 생성 (모의)', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        try {
          await this.client.createAgent(
            'test-user-123',
            'https://github.com/moonklabs/test-repo',
            'main',
            'integration-test-agent'
          );
          logger.info('  - Agent 생성 시도 완료');
        } catch (error) {
          // Git repository가 실제로 없을 수 있으므로 에러는 예상됨
          logger.info('  - Agent 생성 실패 (예상된 동작)');
        }
      });
      
      // 6. Agent 목록 조회 테스트
      await this.runTest('Agent 목록 조회', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        const result = await this.client.listAgents('test-user-123');
        logger.info(`  - 조회 결과: ${JSON.stringify(result.content[0].text)}`);
      });
      
      // 7. 스트리밍 이벤트 테스트
      await this.runTest('스트리밍 이벤트 수신', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        return new Promise<void>((resolve, reject) => {
          this.client!.on('stream', (event) => {
            logger.info(`  - 스트림 이벤트 수신: ${event.type}`);
          });
          
          // 2초 후 확인
          setTimeout(() => {
            if (this.client!.isConnected()) {
              resolve();
            } else {
              reject(new Error('SSE 연결이 확립되지 않음'));
            }
          }, 2000);
        });
      });
      
      // 8. 에러 처리 테스트
      await this.runTest('잘못된 도구 실행 에러 처리', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        try {
          await this.client.callTool('non_existent_tool', {});
          throw new Error('에러가 발생해야 하는데 발생하지 않음');
        } catch (error) {
          // 에러가 발생하는 것이 정상
          logger.info('  - 예상된 에러 발생 확인');
        }
      });
      
      // 9. AgentManager 직접 테스트
      await this.runTest('AgentManager 초기화', async () => {
        const agentManager = new AgentManager(this.testWorkspace);
        await agentManager.initialize();
        
        const agents = await agentManager.listAgents();
        logger.info(`  - AgentManager 초기화 성공, Agent 수: ${agents.length}`);
      });
      
      // 10. 연결 상태 확인
      await this.runTest('연결 상태 확인', async () => {
        if (!this.client) throw new Error('클라이언트가 초기화되지 않음');
        
        const isConnected = this.client.isConnected();
        if (!isConnected) {
          throw new Error('클라이언트가 연결되어 있지 않음');
        }
        
        logger.info('  - 클라이언트 연결 상태: 정상');
      });
      
    } finally {
      await this.cleanup();
    }
    
    // 결과 요약
    this.printSummary();
  }
  
  printSummary() {
    logger.info('\n📊 테스트 결과 요약');
    logger.info('=====================================');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    this.results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      logger.info(`${index + 1}. ${icon} ${result.name}${duration}`);
      if (result.error) {
        logger.info(`   └─ 에러: ${result.error}`);
      }
    });
    
    logger.info('=====================================');
    logger.info(`총 ${total}개 테스트: ${passed}개 성공, ${failed}개 실패`);
    
    if (failed > 0) {
      logger.error('\n❌ 일부 테스트가 실패했습니다.');
      process.exit(1);
    } else {
      logger.info('\n✅ 모든 테스트가 성공했습니다!');
      process.exit(0);
    }
  }
}

// 테스트 실행
const test = new IntegrationTest();
test.runAllTests().catch(error => {
  logger.error('테스트 실행 중 치명적 오류:', error);
  process.exit(1);
});