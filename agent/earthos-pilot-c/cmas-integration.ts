import { EarthOSClient } from './earthosClient.js';
import type {
  RobotArm, SensorReading, ActuatorCommand,
  SwarmConfig, SafetyEnvelope, EarthOSConfig,
} from './earthosTypes.js';
import type { CMASWorkflow, CMASAgentDef, ArchitecturalConstitution } from '../cmas/types.js';
import type { AgentAction } from '../types/actions.js';

export interface EarthOSSession {
  workflow: CMASWorkflow;
  client: EarthOSClient;
  startedAt: string;
  evidenceLog: string[];
  commandLog: ActuatorCommand[];
}

const ROLE_SAFETY_MAP: Record<string, Partial<SafetyEnvelope>> = {
  architect: {
    contracts: [{ contract_id: 'C-ARCH', type: 'NO_ACTUATION_WITHOUT_GOVERNANCE', severity: 'CRITICAL', condition: 'architect intent required', consequence: 'block' }],
    valid_from: 0,
    valid_until: Infinity,
    signature: 'sha3-256:' + '0'.repeat(64),
  },
  builder: {
    contracts: [{ contract_id: 'C-BUILD', type: 'NO_ACTUATION_WITHOUT_EVIDENCE', severity: 'CRITICAL', condition: 'evidence before build', consequence: 'block' }],
    valid_from: 0,
    valid_until: Infinity,
    signature: 'sha3-256:' + '1'.repeat(64),
  },
  implementor: {
    contracts: [
      { contract_id: 'C-IMP-EVID', type: 'NO_ACTUATION_WITHOUT_EVIDENCE', severity: 'MAJOR', condition: 'evidence before implementation', consequence: 'block' },
      { contract_id: 'C-IMP-GOV', type: 'NO_ACTUATION_WITHOUT_GOVERNANCE', severity: 'MAJOR', condition: 'governance clearance for implementation', consequence: 'block' },
    ],
    valid_from: 0,
    valid_until: Infinity,
    signature: 'sha3-256:' + '2'.repeat(64),
  },
  validator: {
    contracts: [{ contract_id: 'C-VALID', type: 'NO_ACTUATION_WITHOUT_GOVERNANCE', severity: 'CRITICAL', condition: 'validation requires authority', consequence: 'block' }],
    valid_from: 0,
    valid_until: Infinity,
    signature: 'sha3-256:' + '3'.repeat(64),
  },
  reviewer: {
    contracts: [
      { contract_id: 'C-REV-EVID', type: 'NO_ACTUATION_WITHOUT_EVIDENCE', severity: 'CRITICAL', condition: 'review requires evidence', consequence: 'block' },
      { contract_id: 'C-REV-GOV', type: 'NO_ACTUATION_WITHOUT_GOVERNANCE', severity: 'CRITICAL', condition: 'review requires governance', consequence: 'block' },
    ],
    valid_from: 0,
    valid_until: Infinity,
    signature: 'sha3-256:' + '4'.repeat(64),
  },
};

export function createEarthOSSession(workflow: CMASWorkflow, config?: Partial<EarthOSConfig>): EarthOSSession {
  const client = new EarthOSClient(config);

  for (const role of Object.keys(ROLE_SAFETY_MAP)) {
    const partial = ROLE_SAFETY_MAP[role];
    const envelope: SafetyEnvelope = {
      envelope_id: `cmas-${role}-${workflow.id}`,
      robot_id: `cmas-${role}`,
      contracts: partial.contracts ?? [],
      valid_from: partial.valid_from ?? 0,
      valid_until: partial.valid_until ?? Infinity,
      signature: partial.signature ?? '',
    };
    client.registerEnvelope(envelope);
  }

  return {
    workflow,
    client,
    startedAt: new Date().toISOString(),
    evidenceLog: [],
    commandLog: [],
  };
}

export function registerAgentInSession(session: EarthOSSession, agent: CMASAgentDef): RobotArm {
  const arm: RobotArm = {
    robot_id: agent.id,
    name: agent.name,
    position: { x: 0, y: 0 },
    role: agent.role === 'architect' || agent.role === 'reviewer' ? 'supervisor' : 'miner',
    capabilities: [agent.role],
    token_id: `tok-${agent.id}`,
    status: 'idle',
  };
  session.client.registerAgent(arm);
  return arm;
}

export async function governEarthOSAction(
  session: EarthOSSession,
  agentOrRole: CMASAgentDef | string,
  action: AgentAction,
  hasEvidence: boolean,
  hasGovernance: boolean,
): Promise<{ approved: boolean; violations: string[] }> {
  const robotId = typeof agentOrRole === 'string' ? `cmas-${agentOrRole}` : agentOrRole.id;
  const role = typeof agentOrRole === 'string' ? agentOrRole : agentOrRole.role;

  const command: ActuatorCommand = {
    command_id: `cmd-${Date.now()}`,
    robot_id: robotId,
    actuator: 'joint',
    action: action.name,
    parameters: action.payload ?? {},
    evidence_hash: hasEvidence ? session.client.computeEvidenceHash({ action, session: session.workflow.id }) : null,
    governance_approval: hasGovernance ? `gov-${Date.now()}` : null,
  };

  const safety = session.client.checkAction(robotId, action.name, hasEvidence, hasGovernance);
  if (safety.allowed) {
    const result = await session.client.sendCommand(command);
    if (result.ok) {
      session.commandLog.push(command);
      if (hasEvidence) session.evidenceLog.push(command.evidence_hash!);
    }
  }

  return { approved: safety.allowed, violations: safety.violations };
}

export function getEarthOSSessionStatus(session: EarthOSSession): {
  workflowId: string;
  robotCount: number;
  envelopeCount: number;
  auditChainValid: boolean;
  evidenceCount: number;
  commandCount: number;
} {
  const state = session.client.getGovernanceState();
  return {
    workflowId: session.workflow.id,
    robotCount: session.client.getGovernanceState().active_boundaries,
    envelopeCount: state.envelope_count,
    auditChainValid: state.audit_chain_valid,
    evidenceCount: session.evidenceLog.length,
    commandCount: session.commandLog.length,
  };
}

export function closeEarthOSSession(session: EarthOSSession): void {
  session.client.getAuditLog();
}
