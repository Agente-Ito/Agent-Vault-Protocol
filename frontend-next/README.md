# Vaultia — Frontend

Next.js 15 frontend for the Agent Vault Protocol. Lets users create and manage policy-governed financial vaults on LUKSO, assign AI agent controllers with isolated keypairs, and execute payments directly from the browser.

## Stack

- **Next.js 15** — App Router, fully static export (no server-side runtime required)
- **ethers.js v6** — All on-chain interaction, LSP6 KeyManager routing
- **RainbowKit + wagmi** — Wallet connection
- **IndexedDB** — Local encrypted storage for controller keys (never sent to any server)
- **Tailwind CSS + CSS custom properties** — Theming system compatible with LUKSO's design language

## Features

| Area | What it does |
|---|---|
| **Vaults** | Deploy policy vaults via `AgentVaultRegistry` with budget, period, merchant whitelist, and agent permissions |
| **Missions** | Create isolated LSP6 controller keypairs per spending objective, set on-chain permissions from preset templates |
| **Run (manual)** | Browser-side transaction execution — unlock controller key with passphrase, simulate via PolicyEngine, send via KeyManager |
| **Pause / Resume** | Zero-out or restore controller permissions on-chain via `km.execute()` |
| **Kill Switch** | Permanently revoke controller permissions on-chain |
| **Profiles** | Browse and save LUKSO Universal Profile contacts; use them as recipients directly in the vault wizard |
| **Simple wizard** | 5-step guided vault creation with goal presets, automation config, and safety levels |

## Network support

| Network | Vaults | Missions | Automation |
|---|---|---|---|
| **LUKSO Testnet (4201)** | ✅ | ✅ | ✅ |
| **LUKSO Mainnet (42)** | ✅ | ✅ | ✅ |
| Base | Coming soon | — | — |

## Local development

```bash
cd frontend-next
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.lukso.network
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
```

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

Set two environment variables in the Vercel dashboard:

```
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.lukso.network
NEXT_PUBLIC_REGISTRY_ADDRESS=0x<your_registry_address>
```

Then push — all routes are static, no serverless functions required.

## Security model for controller keys

- Keys are generated with `ethers.Wallet.createRandom()` entirely in the browser
- Encrypted with AES-GCM (256-bit), key derived via PBKDF2 (200 000 iterations) from a user passphrase
- Stored in IndexedDB — not in localStorage, not in cookies, never sent to any server
- Held in a React `ref` after unlock (not in state), auto-locked after 15 minutes of inactivity or on tab blur
- The passphrase is never stored anywhere

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | Yes | LUKSO JSON-RPC endpoint |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Yes | Deployed `AgentVaultRegistry` contract address |

## License

MIT — see [`LICENSE`](../LICENSE) at the repository root.
