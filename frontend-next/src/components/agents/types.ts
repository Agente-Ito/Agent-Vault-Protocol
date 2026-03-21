export interface AgentRecord {
  address: string;
  roles: string[];
  isContract: boolean;
  maxGasPerCall: number;
  allowedAutomation: boolean;
}
