import { type WalletClient } from "viem";
import { BrowserProvider, JsonRpcSigner } from "ethers";

/**
 * Converts a wagmi WalletClient (viem-backed) to an ethers v6 JsonRpcSigner.
 * Standard bridge pattern for wagmi v2 + ethers v6 interop.
 */
export function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient;
  if (!chain) throw new Error("walletClientToSigner: no chain on WalletClient");
  if (!account) throw new Error("walletClientToSigner: no account on WalletClient");

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: (chain.contracts as { ensRegistry?: { address: string } } | undefined)
      ?.ensRegistry?.address,
  };

  // transport is EIP-1193 compatible — BrowserProvider wraps it for ethers v6
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new BrowserProvider(transport as any, network);

  return new JsonRpcSigner(provider, account.address);
}
