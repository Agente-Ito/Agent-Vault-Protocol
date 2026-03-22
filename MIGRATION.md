# Migration Guide — deployForAgent() Extension

This document explains what changed in each contract, how existing deployments are
affected, and what manual steps are required for existing vaults.

---

## Summary of changes

Five existing contracts were extended. All changes are **additive** — no existing
function signature was removed or modified in a breaking way, except for the
`AgentVaultRegistry` constructor which now requires two additional addresses.

---

## Contract by contract

### `AgentCoordinator.sol`

#### AgentCoordinator new constants

```solidity
bytes32 public constant CAN_DEPLOY = keccak256("CAN_DEPLOY");
uint256 public constant MAX_DELEGATION_DEPTH = 3;
```

#### AgentCoordinator new storage

```solidity
mapping(address => uint256) public delegationDepth;
mapping(address => bool)    public authorizedCaller;
```

#### Modified `onlyRoleAdmin` modifier

Now also allows addresses in `authorizedCaller`. This is how the Registry can
call `registerAgent()`, `assignRole()`, and `setDelegationDepth()` during a
single atomic `deployForAgent()` transaction without being the roleAdmin.

#### AgentCoordinator new functions

- `setAuthorizedCaller(address caller, bool enabled)` — owner only
- `setDelegationDepth(address agent, uint256 depth)` — authorizedCaller only
- `getDelegationDepth(address agent)` — view
- `isSubset(address agent, bytes32[] caps)` — view; returns true if agent holds all caps

#### Impact on existing agents

None. `delegationDepth` defaults to 0 for all
existing agents, which is the correct value (they were registered outside the
delegation chain and do not have restricted depth). `authorizedCaller` for
existing callers defaults to false.

---

### `SharedBudgetPool.sol`

#### SharedBudgetPool new storage

```solidity
mapping(address => bool) public authorizedDeployer;
```

#### Modified `createPool()`

Changed from `onlyOwner` to `owner || authorizedDeployer[msg.sender]`.
The Registry is added to `authorizedDeployer` post-deploy so it can create
child pools atomically during `deployForAgent()`.

#### SharedBudgetPool new function

- `setAuthorizedDeployer(address deployer, bool enabled)` — owner only

#### Impact on existing pools

None. Existing pools are unchanged. `authorizedDeployer`
defaults to false for all addresses.

---

### `AgentVaultRegistry.sol`

#### Constructor change (breaking for redeploy)

```solidity
// Before
constructor(address _core, address _deployer, address _km)

// After
constructor(address _core, address _deployer, address _km, address _coordinator, address _pool)
```

Existing deployed Registry instances are unaffected — they do not need to be
redeployed unless you want `deployForAgent()`. New deployments must pass all 5 args.

#### AgentVaultRegistry new storage

```solidity
mapping(address => address) public vaultRootOwner;
mapping(address => address) public vaultOperator;
mapping(address => address) public agentRootOwner;
mapping(address => address[]) private _agentDeployedVaults;
```

All default to `address(0)` for vaults created before this update.

#### Modified `deployVault()`

Added one line before `_deployStack()`:

```solidity
agentRootOwner[msg.sender] = msg.sender;
```

Humans are their own root. This enables resolution for any agents they later
authorize with `CAN_DEPLOY`. Existing vaults deployed before this update are
unaffected — they simply do not have this mapping set.

#### New function: `deployForAgent()`

Allows an agent with `CAN_DEPLOY` to atomically deploy a child vault, carve
budget from its own pool, and register an operator agent — all in one transaction
that either fully succeeds or fully reverts.

#### AgentVaultRegistry new constants

```solidity
uint256 public constant MIN_GAS_FOR_DEPLOY_FOR_AGENT = 5_500_000;
```

#### AgentVaultRegistry new events

```solidity
event AgentVaultDeployed(
    address indexed deployingOperator,
    address indexed rootOwner,
    address indexed newVault,
    address assignedAgent,
    uint256 budgetLimit,
    uint256 gasUsed,
    uint256 timestamp
);
```

#### AgentVaultRegistry new view functions

- `getRootOwner(address vault)` — returns the human root for agent-deployed vaults
- `getVaultsDeployedBy(address agent)` — returns all vaults an agent has deployed
- `isAgentDeployed(address vault)` — true if deployed via `deployForAgent()`

---

### `PolicyEngine.sol`

#### PolicyEngine new storage

```solidity
bool public paused;
```

#### PolicyEngine new event

```solidity
event PauseStatusChanged(bool paused);
```

#### PolicyEngine new function

- `setPaused(bool shouldPause)` — owner only

#### PolicyEngine modified behavior

- `validate()` now reverts with `PE: paused` while the engine is paused
- `simulateExecution()` now returns `(address(this), "PE: paused")` while paused

#### PolicyEngine operational impact

This is now the primary vault-wide kill switch. Instead of
removing policies individually, the owner can freeze and later resume the vault's
entire safe-routed execution path with a single transaction.

---

### `TaskScheduler.sol`

#### TaskScheduler modified constructor behavior

- `keeperWhitelistEnabled` now starts as `true`
- the deployer is added to `isWhitelistedKeeper` in the constructor

#### TaskScheduler impact on existing schedulers

Existing deployed scheduler instances keep their
current configuration. Only newly deployed instances pick up the secure-by-default
whitelist behavior automatically.

#### TaskScheduler operational impact

New deployments must explicitly add backup keeper addresses
with `addKeeper()` if they do not intend to use the deployer key as the only keeper.

---

## Existing deployments — no action needed

Existing vaults, agents, pools, and key managers are **completely unaffected**.

- All new storage slots default to `address(0)` and are never read by existing paths
- `deployVault()` behavior is identical except for the `agentRootOwner` write,
  which does not affect any other contract or permission
- `deployVaultOnBehalf()` is unchanged
- All existing events still fire with identical arguments
- Existing `PolicyEngine` instances do not gain a pause switch retroactively; the
    new pause functionality applies to newly deployed engines from the updated code
- Existing `TaskScheduler` deployments keep their current whitelist configuration

---

## Manual step for existing human vaults

If you deployed a vault before this update and want to grant `CAN_DEPLOY` to an
agent, you have two options:

**Option A (recommended):**

Call `deployVault()` one more time with the new Registry.
The new code will set `agentRootOwner[yourAddress] = yourAddress` automatically.
Then grant `CAN_DEPLOY` to your agent via `coordinator.grantCapability()`.

**Option B:**

The old vault and its KeyManager still works normally. Only the
new `deployForAgent()` path is gated — your agents can still perform all their
existing capabilities through the old vault without any migration.

---

## Deploy script changes

`scripts/deploy.ts` was updated to:

1. Deploy `SharedBudgetPool` (step 7, before Registry)
2. Pass `coordinatorAddr` and `sharedBudgetPoolAddr` to the Registry constructor
3. Call `coordinator.setAuthorizedCaller(registryAddr, true)` post-deploy
4. Call `sharedBudgetPool.setAuthorizedDeployer(registryAddr, true)` post-deploy
5. Include `sharedBudgetPoolAddress` in the deployment JSON output
6. Deploy a `TaskScheduler` that starts with whitelist enforcement enabled and the deployer already whitelisted

### Recommended post-deploy hardening

1. Add one or more backup keepers with `taskScheduler.addKeeper(address)`
2. Document who controls `PolicyEngine.setPaused()` for each vault
3. Run an incident drill for `setPaused(true)` and keeper rotation before production rollout

---

## Gas considerations

`deployForAgent()` requires a minimum of **5.5M gas** (enforced on-chain), but the
measured execution path in tests is materially higher: roughly **8.2M–8.4M gas**.
For scripts, keepers, or frontends calling `deployForAgent()`, use a practical
buffer such as `{ gasLimit: 9_000_000 }` or higher and recalibrate on the target
network using the emitted `AgentVaultDeployed.gasUsed` value.
