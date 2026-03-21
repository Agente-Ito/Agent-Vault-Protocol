import { useQuery } from '@tanstack/react-query';
import { ethers, EventLog } from 'ethers';
import type { AgentRecord } from '@/components/agents/types';
import { getCoordinatorContract } from '@/lib/web3/contracts';
import { useWeb3 } from '@/context/Web3Context';
import { getReadOnlyProvider } from '@/lib/web3/provider';

const COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_COORDINATOR_ADDRESS ?? '';

function decodeRole(role: string): string {
  try {
    return ethers.decodeBytes32String(role);
  } catch {
    return `${role.slice(0, 10)}...${role.slice(-6)}`;
  }
}

async function fetchAgents(): Promise<AgentRecord[]> {
  if (!COORDINATOR_ADDRESS) {
    return [];
  }

  const coordinator = getCoordinatorContract(COORDINATOR_ADDRESS, getReadOnlyProvider());
  const events = await coordinator.queryFilter(coordinator.filters.AgentRegistered());
  const agentAddresses = [
    ...new Set(
      events
        .flatMap((event) => ('args' in event ? [String((event as EventLog).args.agent ?? '')] : []))
        .filter(Boolean)
    ),
  ];

  const agents = await Promise.all(
    agentAddresses.map(async (address) => {
      const [config, roles] = await Promise.all([
        coordinator.getAgentConfig(address),
        coordinator.getAgentRoles(address),
      ]);

      return {
        address,
        isContract: Boolean(config[0]),
        maxGasPerCall: Number(config[1]),
        allowedAutomation: Boolean(config[2]),
        roles: roles.map(decodeRole),
      } satisfies AgentRecord;
    })
  );

  return agents.sort((left, right) => left.address.localeCompare(right.address));
}

export function useAgents() {
  const enabled = !!COORDINATOR_ADDRESS;

  return useQuery({
    queryKey: ['agents', COORDINATOR_ADDRESS],
    queryFn: fetchAgents,
    enabled,
    staleTime: 30_000,
  });
}

export function useCoordinatorAdmin() {
  const { coordinator, isCoordinatorConfigured } = useWeb3();

  return useQuery({
    queryKey: ['coordinator-admin', COORDINATOR_ADDRESS],
    queryFn: async () => {
      if (!coordinator) {
        throw new Error('AgentCoordinator not configured');
      }

      return coordinator.roleAdmin();
    },
    enabled: isCoordinatorConfigured && !!coordinator,
    staleTime: 30_000,
  });
}