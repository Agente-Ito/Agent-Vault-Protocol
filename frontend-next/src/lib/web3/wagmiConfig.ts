"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  universalProfilesWallet,
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "viem/chains";
import { luksoTestnet, luksoMainnet } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "DEVELOPMENT";

const connectors = connectorsForWallets(
  [
    {
      groupName: "LUKSO",
      wallets: [universalProfilesWallet],
    },
    {
      groupName: "Other Wallets",
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: "AI Financial Operating System", projectId }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [luksoTestnet, luksoMainnet, baseSepolia, base],
  transports: {
    [luksoTestnet.id]: http(),
    [luksoMainnet.id]: http(),
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
