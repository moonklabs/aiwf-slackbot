import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { AgentConfig, ExecutionError } from '../types';
import { Config } from '../utils/config';
import { logger } from '../utils/logger';
import { RepositoryManager } from './repositoryManager';

export class AgentManager {
  private agents: Map<string, AgentConfig>;
  private storageFile: string;
  private repositoryManager: RepositoryManager;
  private workspaceDir: string;
  private agentsFilePath: string;
  
  constructor(workspaceDir?: string) {
    this.agents = new Map();
    this.workspaceDir = workspaceDir || Config.workspaceDir;
    this.storageFile = path.join(this.workspaceDir, 'agents.json');
    this.agentsFilePath = this.storageFile;
    this.repositoryManager = new RepositoryManager();
  }
  
  /**
   * 저장소에서 Agent 목록 로드
   */
  async initialize(): Promise<void> {
    // workspace 디렉토리 확인 및 생성
    try {
      await fs.access(this.workspaceDir);
    } catch {
      await fs.mkdir(this.workspaceDir, { recursive: true });
      await fs.mkdir(path.join(this.workspaceDir, 'agents'), { recursive: true });
    }

    // agents.json 파일 확인 및 생성
    try {
      await fs.access(this.agentsFilePath);
    } catch {
      await this.saveAgents();
    }

    try {
      const data = await fs.readFile(this.storageFile, 'utf-8');
      const agentsArray: AgentConfig[] = JSON.parse(data);
      
      // Date 객체로 변환
      agentsArray.forEach(agent => {
        agent.createdAt = new Date(agent.createdAt);
        agent.lastUsed = new Date(agent.lastUsed);
        this.agents.set(agent.id, agent);
      });
      
      logger.info(`${this.agents.size}개의 Agent 로드 완료`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // 파일이 없으면 빈 상태로 시작
        logger.info('Agent 저장 파일이 없음, 새로 시작');
        await this.save();
      } else {
        logger.error('Agent 로드 실패', error);
        throw error;
      }
    }
  }
  
  /**
   * Agent 목록을 파일에 저장
   */
  private async save(): Promise<void> {
    const agentsArray = Array.from(this.agents.values());
    await fs.writeFile(this.storageFile, JSON.stringify(agentsArray, null, 2));
  }
  
  /**
   * 빈 agents.json 파일 생성
   */
  private async saveAgents(): Promise<void> {
    await fs.writeFile(this.agentsFilePath, '[]', 'utf-8');
  }
  
  /**
   * 새로운 Agent 생성
   */
  async createAgent(
    owner: string,
    gitRepo: string,
    options: {
      name?: string;
      type?: 'claude' | 'gemini';
      branch?: string;
      channelId?: string;
    } = {}
  ): Promise<AgentConfig> {
    const agentId = uuidv4();
    const agentDir = path.join(this.workspaceDir, 'agents', agentId);
    const repoDir = path.join(agentDir, 'repo');
    
    const agent: AgentConfig = {
      id: agentId,
      name: options.name || `agent-${agentId.substring(0, 8)}`,
      type: options.type || 'claude',
      gitRepo,
      branch: options.branch,
      workspaceDir: repoDir,
      owner,
      channelId: options.channelId,
      createdAt: new Date(),
      lastUsed: new Date(),
      status: 'initializing'
    };
    
    // Agent 등록
    this.agents.set(agentId, agent);
    await this.save();
    
    try {
      // 디렉토리 생성
      await fs.mkdir(agentDir, { recursive: true });
      
      // Repository 클론
      logger.info(`Repository 클론 시작: ${gitRepo}`);
      await this.repositoryManager.cloneRepository(gitRepo, repoDir, options.branch);
      
      // Agent 설정 파일 저장
      const configPath = path.join(agentDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(agent, null, 2));
      
      // 상태 업데이트
      agent.status = 'active';
      await this.save();
      
      logger.info(`Agent 생성 완료: ${agent.name} (${agentId})`);
      return agent;
      
    } catch (error) {
      // 실패 시 정리
      agent.status = 'error';
      agent.error = (error as Error).message;
      await this.save();
      
      // 디렉토리 정리 시도
      try {
        await fs.rm(agentDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error('Agent 디렉토리 정리 실패', cleanupError);
      }
      
      throw new ExecutionError(`Agent 생성 실패: ${(error as Error).message}`, 'AGENT_CREATE_FAILED');
    }
  }
  
  /**
   * Agent 조회
   */
  async getAgent(agentIdOrName: string, userId?: string): Promise<AgentConfig | null> {
    // ID로 찾기
    let agent = this.agents.get(agentIdOrName);
    
    // 이름으로 찾기
    if (!agent) {
      agent = Array.from(this.agents.values()).find(a => 
        a.name === agentIdOrName && (!userId || a.owner === userId)
      );
    }
    
    if (agent && userId && agent.owner !== userId) {
      // 권한 확인
      throw new ExecutionError('해당 Agent에 대한 권한이 없습니다', 'UNAUTHORIZED');
    }
    
    return agent || null;
  }
  
  /**
   * Agent 목록 조회
   */
  async listAgents(userId?: string, channelId?: string): Promise<AgentConfig[]> {
    let agents = Array.from(this.agents.values());
    
    if (userId) {
      agents = agents.filter(a => a.owner === userId);
    }
    
    if (channelId) {
      agents = agents.filter(a => a.channelId === channelId);
    }
    
    return agents.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }
  
  /**
   * Agent 사용 시간 업데이트
   */
  async updateLastUsed(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastUsed = new Date();
      await this.save();
    }
  }
  
  /**
   * Agent 삭제
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    const agent = await this.getAgent(agentId, userId);
    if (!agent) {
      throw new ExecutionError('Agent를 찾을 수 없습니다', 'AGENT_NOT_FOUND');
    }
    
    // 디렉토리 삭제
    const agentDir = path.join(this.workspaceDir, 'agents', agent.id);
    try {
      await fs.rm(agentDir, { recursive: true, force: true });
    } catch (error) {
      logger.error('Agent 디렉토리 삭제 실패', error);
    }
    
    // 메모리와 저장소에서 제거
    this.agents.delete(agent.id);
    await this.save();
    
    logger.info(`Agent 삭제 완료: ${agent.name} (${agent.id})`);
  }
  
  /**
   * Agent 상태 업데이트
   */
  async updateAgentStatus(
    agentId: string, 
    status: AgentConfig['status'], 
    error?: string
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      if (error) {
        agent.error = error;
      } else {
        delete agent.error;
      }
      await this.save();
    }
  }
  
  /**
   * Repository 업데이트
   */
  async updateRepository(agentId: string, userId: string): Promise<void> {
    const agent = await this.getAgent(agentId, userId);
    if (!agent) {
      throw new ExecutionError('Agent를 찾을 수 없습니다', 'AGENT_NOT_FOUND');
    }
    
    try {
      await this.repositoryManager.updateRepository(agent.workspaceDir);
      agent.lastUsed = new Date();
      await this.save();
    } catch (error) {
      throw new ExecutionError(
        `Repository 업데이트 실패: ${(error as Error).message}`, 
        'REPO_UPDATE_FAILED'
      );
    }
  }
}