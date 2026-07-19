import { spawnSync, execSync, type ExecSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  SafetyEnforcementEngine, SafetyEnvelope, SafetyContract,
} from '../../safety-envelope/src/enforcer.js';
import { GridWorldSimulator } from '../../swarm/grid-world/src/simulator.js';
import type {
  RobotArm, SensorReading, ActuatorCommand,
  SwarmConfig, SwarmMember, GridWorld,
  GovernanceState, EarthOSConfig, GridPosition,
} from './earthosTypes.js';

const EARTHOS_ROOT = resolve(import.meta.dirname ?? __dirname, '../../EarthOS-Pilot-C');

export class EarthOSClient {
  private safetyEngine: SafetyEnforcementEngine;
  private simulator: GridWorldSimulator | null = null;
  private agents: Map<string, RobotArm> = new Map();
  private config: EarthOSConfig;

  constructor(config: Partial<EarthOSConfig> = {}) {
    this.safetyEngine = new SafetyEnforcementEngine();
    this.config = {
      node_id: 'earthos-node-1',
      deployment: 'development',
      safety_level: 'maximum',
      evidence_required: true,
      governance_required: true,
      swarm_enabled: false,
      audit_log_path: join(EARTHOS_ROOT, 'dist', 'audit'),
      drift_check_interval_ms: 5000,
      ...config,
    };
  }

  getConfig(): EarthOSConfig {
    return { ...this.config };
  }

  registerEnvelope(envelope: SafetyEnvelope): void {
    this.safetyEngine.registerEnvelope(envelope);
  }

  checkAction(
    robot_id: string,
    action_type: string,
    hasEvidence: boolean,
    hasGovernanceClearance: boolean,
  ): { allowed: boolean; violations: string[] } {
    return this.safetyEngine.checkAction(robot_id, action_type, hasEvidence, hasGovernanceClearance);
  }

  getAuditLog() {
    return this.safetyEngine.getAuditLog();
  }

  verifyAuditChain(): boolean {
    return this.safetyEngine.verifyAuditChain();
  }

  registerAgent(agent: RobotArm): void {
    this.agents.set(agent.robot_id, agent);
    if (this.simulator) {
      this.simulator.addAgent({
        agent_id: agent.robot_id,
        role: agent.role,
        capabilities: agent.capabilities,
        position: agent.position,
        token_id: agent.token_id,
      });
    }
  }

  getAgent(robot_id: string): RobotArm | undefined {
    return this.agents.get(robot_id);
  }

  initSwarm(config: SwarmConfig): void {
    this.simulator = new GridWorldSimulator(config.world_width, config.world_height);
    for (const contract of config.safety_contracts) {
      this.safetyEngine.registerEnvelope({
        envelope_id: `swarm-${contract.contract_id}`,
        robot_id: 'swarm',
        contracts: [contract],
        valid_from: Date.now(),
        valid_until: Date.now() + 86_400_000,
        signature: '',
      });
    }
  }

  getSimulator(): GridWorldSimulator | null {
    return this.simulator;
  }

  getSwarmState(): GridWorld | null {
    if (!this.simulator) return null;
    const state = this.simulator.getState();
    return {
      width: state.width,
      height: state.height,
      resources: state.resources,
      agents: state.agents.map((a) => {
        const arm = this.agents.get(a.agent_id);
        return {
          agent_id: a.agent_id,
          role: a.role,
          position: a.position,
          token_id: a.token_id,
          status: (arm?.status ?? 'idle') as SwarmMember['status'],
          last_heartbeat: Date.now(),
        };
      }),
    };
  }

  async readSensor(robot_id: string, sensor_type: string): Promise<SensorReading> {
    const sensorScript = join(EARTHOS_ROOT, 'sensors', sensor_type, 'src', 'index.ts');
    if (existsSync(sensorScript)) {
      return this.runSubprocess('npx', ['tsx', sensorScript, robot_id]);
    }
    return {
      sensor_id: `${sensor_type}-${robot_id}`,
      robot_id,
      type: sensor_type as SensorReading['type'],
      value: 0,
      unit: 'raw',
      timestamp: Date.now(),
      confidence: 1.0,
    };
  }

  async sendCommand(command: ActuatorCommand): Promise<{ ok: boolean; error?: string }> {
    const safety = this.safetyEngine.checkAction(
      command.robot_id,
      command.action,
      !!command.evidence_hash,
      !!command.governance_approval,
    );
    if (!safety.allowed) {
      return { ok: false, error: `Safety violation: ${safety.violations.join(', ')}` };
    }

    if (this.simulator && command.actuator === 'drive' && typeof command.parameters.dx === 'number' && typeof command.parameters.dy === 'number') {
      const moved = this.simulator.moveAgent(command.robot_id, command.parameters.dx as number, command.parameters.dy as number);
      if (!moved) return { ok: false, error: 'Movement out of bounds' };
    }

    if (command.actuator === 'gripper' && command.action === 'collect' && this.simulator) {
      const collected = this.simulator.collectResource(command.robot_id);
      if (!collected) return { ok: false, error: 'No resource to collect or not a miner' };
    }

    const arm = this.agents.get(command.robot_id);
    if (arm) {
      arm.status = 'moving';
      setTimeout(() => { arm.status = 'idle'; }, 100);
    }

    return { ok: true };
  }

  getGovernanceState(): GovernanceState {
    return {
      kernel_seeded: true,
      envelope_count: this.safetyEngine.getAuditLog().length,
      audit_chain_length: this.safetyEngine.getAuditLog().length,
      audit_chain_valid: this.safetyEngine.verifyAuditChain(),
      active_boundaries: this.agents.size,
      csr_ledger_size: 0,
    };
  }

  computeEvidenceHash(payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return `sha3-256:${createHash('sha3-256').update(canonical, 'utf8').digest('hex')}`;
  }

  private async runSubprocess(cmd: string, args: string[]): Promise<any> {
    const result = spawnSync(cmd, args, {
      cwd: EARTHOS_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    } as ExecSyncOptions);
    if (result.status !== 0) {
      throw new Error(`Subprocess failed: ${result.stderr || result.stdout}`);
    }
    return JSON.parse(result.stdout.trim());
  }
}
