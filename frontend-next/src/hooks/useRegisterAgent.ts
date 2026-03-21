import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';

interface RegisterAgentInput {
  agent: string;
  maxGasPerCall: number;
  allowedAutomation: boolean;
}

export function useRegisterAgent() {
  const queryClient = useQueryClient();
  const { account, coordinator } = useWeb3();

  return useMutation({
    mutationFn: async ({ agent, maxGasPerCall, allowedAutomation }: RegisterAgentInput) => {
      if (!coordinator) {
        throw new Error('AgentCoordinator is not configured.');
      }

      if (!account) {
        throw new Error('Connect the admin wallet before registering agents.');
      }

      if (!ethers.isAddress(agent)) {
        throw new Error('Enter a valid agent address.');
      }

      if (maxGasPerCall < 0 || !Number.isFinite(maxGasPerCall)) {
        throw new Error('Max gas per call must be a valid non-negative number.');
      }

      const roleAdmin = await coordinator.roleAdmin();
      if (roleAdmin.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the Vaultia admin wallet can register beta agents.');
      }

      const tx = await coordinator.registerAgent(agent, Math.trunc(maxGasPerCall), allowedAutomation);
      await tx.wait();
      return tx.hash;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}