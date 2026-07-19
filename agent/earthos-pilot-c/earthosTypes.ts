export type ContractType = 'NO_ACTUATION_WITHOUT_EVIDENCE' | 'NO_ACTUATION_WITHOUT_GOVERNANCE' | 'EMERGENCY_STOP_OVERRIDES_ALL';
export type ContractSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type RobotRole = 'miner' | 'transporter' | 'supervisor';

export interface GridPosition {
  x: number;
  y: number;
}

export interface RobotArm {
  robot_id: string;
  name: string;
  position: GridPosition;
  role: RobotRole;
  capabilities: string[];
  token_id: string;
  status: 'idle' | 'moving' | 'collecting' | 'error';
}

export interface SafetyContract {
  contract_id: string;
  type: ContractType;
  severity: ContractSeverity;
  condition: string;
  consequence: string;
}

export interface SafetyEnvelope {
  envelope_id: string;
  robot_id: string;
  contracts: SafetyContract[];
  valid_from: number;
  valid_until: number;
  signature: string;
}

export interface SensorReading {
  sensor_id: string;
  robot_id: string;
  type: 'proximity' | 'force' | 'temperature' | 'position';
  value: number;
  unit: string;
  timestamp: number;
  confidence: number;
}

export interface ActuatorCommand {
  command_id: string;
  robot_id: string;
  actuator: 'gripper' | 'joint' | 'drive';
  action: string;
  parameters: Record<string, unknown>;
  evidence_hash: string | null;
  governance_approval: string | null;
}

export interface SwarmConfig {
  world_width: number;
  world_height: number;
  max_agents: number;
  governance_model: 'federated' | 'hierarchical' | 'peer';
  safety_contracts: SafetyContract[];
  drift_threshold: number;
}

export interface SwarmMember {
  agent_id: string;
  role: RobotRole;
  position: GridPosition;
  token_id: string;
  status: 'active' | 'idle' | 'suspended' | 'offline';
  last_heartbeat: number;
}

export interface GridWorld {
  width: number;
  height: number;
  resources: { x: number; y: number; type: string }[];
  agents: SwarmMember[];
}

export interface GovernanceState {
  kernel_seeded: boolean;
  envelope_count: number;
  audit_chain_length: number;
  audit_chain_valid: boolean;
  active_boundaries: number;
  csr_ledger_size: number;
}

export interface EarthOSConfig {
  node_id: string;
  deployment: string;
  safety_level: 'maximum' | 'standard' | 'minimum';
  evidence_required: boolean;
  governance_required: boolean;
  swarm_enabled: boolean;
  audit_log_path: string;
  drift_check_interval_ms: number;
}
