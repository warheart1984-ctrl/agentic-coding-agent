export { EarthOSClient } from './earthosClient.js';
export {
  createEarthOSSession, registerAgentInSession,
  governEarthOSAction, getEarthOSSessionStatus, closeEarthOSSession,
} from './cmas-integration.js';
export type { EarthOSSession } from './cmas-integration.js';
export type {
  RobotArm, SafetyContract, SafetyEnvelope,
  SensorReading, ActuatorCommand,
  SwarmConfig, SwarmMember, GridPosition, GridWorld,
  GovernanceState, EarthOSConfig,
  ContractType, ContractSeverity, RobotRole,
} from './earthosTypes.js';
