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
| --- | --- |
| **Vaults** | Deploy policy vaults via `AgentVaultRegistry` with budget, period, merchant whitelist, and agent permissions |
| **Missions** | Create isolated LSP6 controller keypairs per spending objective, set on-chain permissions from preset templates |
| **Run (manual)** | Browser-side transaction execution — unlock controller key with passphrase, simulate via PolicyEngine, send via KeyManager |
| **Pause / Resume (controller)** | Zero-out or restore controller permissions on-chain via `km.execute()` |
| **Kill Switch (controller)** | Permanently revoke controller permissions on-chain |
| **Vault-wide emergency pause** | Supported at protocol level through `PolicyEngine.setPaused(true/false)` to freeze all safe-routed execution for a vault |
| **Profiles** | Browse and save LUKSO Universal Profile contacts; use them as recipients directly in the vault wizard |
| **Simple wizard** | 5-step guided vault creation with goal presets, automation config, and safety levels |

## Network support

| Network | Vaults | Missions | Automation |
| --- | --- | --- | --- |
| **LUKSO Testnet (4201)** | ✅ | ✅ | ✅ |
| **LUKSO Mainnet (42)** | ✅ | ✅ | ✅ |
| Base | Coming soon | — | — |

Automation note:

- Recurring execution is driven by the protocol's `TaskScheduler` plus an off-chain keeper.
- New scheduler deployments start with keeper whitelist enforcement enabled by default.
- The deployer is whitelisted automatically; additional keepers must be added explicitly on-chain.
- This frontend does not currently manage keeper allowlists directly.

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

```env
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

## Execution safety model

- Controller-level pause/resume in the Missions UI works by changing LSP6 controller permissions. This stops that specific controller from acting, but it does not pause the entire vault.
- Vault-wide emergency pause is a protocol-level control on `PolicyEngine`. When `paused == true`, every safe-routed execution that depends on `PolicyEngine.validate()` is blocked with `PE: paused`.
- Spending caps are enforced on-chain by the vault's active policies, not by frontend state.
- Browser-side simulations reflect policy outcomes, and a paused `PolicyEngine` returns a blocked result instead of a normal pass/fail policy scan.

Operational note:

- If the backend/ops team pauses a vault through `PolicyEngine.setPaused(true)`, users may still be able to prepare transactions in the UI, but execution will be blocked on-chain until the vault is resumed.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Yes | LUKSO JSON-RPC endpoint |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Yes | Deployed `AgentVaultRegistry` contract address |

## License

MIT — see [`LICENSE`](../LICENSE) at the repository root.
