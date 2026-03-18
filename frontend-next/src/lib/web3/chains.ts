import { defineChain } from "viem";

export const luksoTestnet = defineChain({
  id: 4201,
  name: "LUKSO Testnet",
  nativeCurrency: { name: "LYXt", symbol: "LYXt", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.lukso.network"] },
    public:  { http: ["https://rpc.testnet.lukso.network"] },
  },
  blockExplorers: {
    default: {
      name: "LUKSO Testnet Explorer",
      url: "https://explorer.execution.testnet.lukso.network",
    },
  },
  testnet: true,
});

export const luksoMainnet = defineChain({
  id: 42,
  name: "LUKSO",
  nativeCurrency: { name: "LYX", symbol: "LYX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.lukso.network"] },
    public:  { http: ["https://rpc.lukso.network"] },
  },
  blockExplorers: {
    default: {
      name: "LUKSO Explorer",
      url: "https://explorer.execution.mainnet.lukso.network",
    },
  },
});
