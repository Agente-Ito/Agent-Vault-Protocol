'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';

const COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_COORDINATOR_ADDRESS ?? '';

interface AssignRoleInput {
  agent: string;
  role: string;
  capabilities: string[];
}

export function useAssignRole() {
  const { coordinator, account } = useWeb3();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agent, role, capabilities }: AssignRoleInput) => {
      if (!coordinator) throw new Error('AgentCoordinator not configured');
      if (!account) throw new Error('Wallet not connected');
      if (!ethers.isAddress(agent)) throw new Error('Invalid agent address');
      if (!role.trim()) throw new Error('Role name is required');

      const roleAdmin = await coordinator.roleAdmin();
      if (roleAdmin.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the roleAdmin can assign roles');
      }

      const roleBytes32 = ethers.encodeBytes32String(role.trim());
      const capBytes32 = capabilities
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => ethers.encodeBytes32String(c));

      const tx = await (coordinator as unknown as {
        assignRole(agent: string, role: string, caps: string[]): Promise<{ wait(): Promise<unknown> }>;
      }).assignRole(agent, roleBytes32, capBytes32);

      await tx.wait();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', COORDINATOR_ADDRESS] });
    },
  });
}
