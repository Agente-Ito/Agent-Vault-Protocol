// ─── Entity taxonomy for onboarding wizard ────────────────────────────────────
// Pure data — no React, no i18n (strings are in English and used as-is since
// this is rich wizard content, not UI chrome).

export type EntityType =
  | 'individual'
  | 'business'
  | 'dao'
  | 'creator'
  | 'fund'
  | 'nonprofit';

export interface SubVaultTemplate {
  id: string;
  emoji: string;
  title: string;
  desc: string;
}

export interface EntityProfile {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  defaultVaultName: string;
  defaultVaultEmoji: string;
  subVaults: SubVaultTemplate[];
}

export interface EntityDefinition {
  id: EntityType;
  emoji: string;
  title: string;
  desc: string;
  profiles: EntityProfile[];
}

// ─── Sub-vault building blocks (reused across profiles) ───────────────────────

const SV = {
  operations:   { id: 'operations',   emoji: '⚙️',  title: 'Operations',        desc: 'Day-to-day operational expenses' },
  payroll:      { id: 'payroll',       emoji: '👷',  title: 'Payroll',           desc: 'Salaries, contractor payments, bounties' },
  reserve:      { id: 'reserve',       emoji: '🏦',  title: 'Reserve / Buffer',  desc: 'Emergency fund and liquidity reserve' },
  rnd:          { id: 'rnd',           emoji: '🔬',  title: 'R&D',               desc: 'Research, development, experiments' },
  marketing:    { id: 'marketing',     emoji: '📣',  title: 'Marketing',         desc: 'Campaigns, growth, community' },
  grants:       { id: 'grants',        emoji: '🤝',  title: 'Grants Pool',       desc: 'Grants to contributors and teams' },
  community:    { id: 'community',     emoji: '🌱',  title: 'Community Fund',    desc: 'Events, rewards, ecosystem incentives' },
  grantOps:     { id: 'grantOps',      emoji: '⚙️',  title: 'Grant Operations',  desc: 'Coordination, tooling, admin costs' },
  protocol:     { id: 'protocol',      emoji: '🔒',  title: 'Protocol Treasury', desc: 'Long-term protocol sustainability' },
  dev:          { id: 'dev',           emoji: '💻',  title: 'Development',       desc: 'Smart contracts, infra, engineering' },
  security:     { id: 'security',      emoji: '🛡️',  title: 'Security / Audits', desc: 'Audit costs, bug bounties, insurance' },
  daily:        { id: 'daily',         emoji: '🛒',  title: 'Daily Expenses',    desc: 'Groceries, transport, subscriptions' },
  bills:        { id: 'bills',         emoji: '🏡',  title: 'Bills & Rent',      desc: 'Housing, utilities, recurring bills' },
  savings:      { id: 'savings',       emoji: '💎',  title: 'Savings',           desc: 'Medium-term savings goals' },
  emergency:    { id: 'emergency',     emoji: '🚨',  title: 'Emergency Fund',    desc: '3–6 months of expenses as safety net' },
  portfolio:    { id: 'portfolio',     emoji: '📈',  title: 'Trading Portfolio', desc: 'Active trading and rebalancing' },
  yield:        { id: 'yield',         emoji: '🌾',  title: 'Yield Farming',     desc: 'Liquidity provision, staking rewards' },
  fees:         { id: 'fees',          emoji: '💸',  title: 'Management Fees',   desc: 'Fee collection and distribution' },
  income:       { id: 'income',        emoji: '💰',  title: 'Income Buffer',     desc: 'Incoming revenue before allocation' },
  taxes:        { id: 'taxes',         emoji: '📋',  title: 'Tax Reserve',       desc: 'Set-aside for tax obligations' },
  projects:     { id: 'projects',      emoji: '🎯',  title: 'Projects',          desc: 'Per-project budgets and milestone payments' },
  equipment:    { id: 'equipment',     emoji: '🎛️',  title: 'Equipment & Tools', desc: 'Gear, software licences, infrastructure' },
  programs:     { id: 'programs',      emoji: '📚',  title: 'Programs',          desc: 'Funded programs and initiatives' },
  donations:    { id: 'donations',     emoji: '🫶',  title: 'Donations Inbox',   desc: 'Incoming donations before allocation' },
  impact:       { id: 'impact',        emoji: '🌍',  title: 'Impact Projects',   desc: 'Direct on-the-ground spending' },
  admin:        { id: 'admin',         emoji: '🗂️',  title: 'Admin & Legal',     desc: 'Legal, compliance, admin overhead' },
  advocacy:     { id: 'advocacy',      emoji: '📢',  title: 'Advocacy',          desc: 'Campaigns, lobbying, awareness' },
  nft:          { id: 'nft',           emoji: '🖼️',  title: 'NFT Portfolio',     desc: 'NFT acquisitions and royalties' },
  lp:           { id: 'lp',            emoji: '🔄',  title: 'LP Positions',      desc: 'Liquidity pool management' },
  travel:       { id: 'travel',        emoji: '✈️',  title: 'Travel',            desc: 'Accommodation, transport, coworking' },
  healthcare:   { id: 'healthcare',    emoji: '🏥',  title: 'Healthcare',        desc: 'Health insurance, medical expenses' },
};

// ─── Entity definitions ────────────────────────────────────────────────────────

export const ENTITY_TYPES: EntityDefinition[] = [
  {
    id: 'individual',
    emoji: '🧑',
    title: 'Individual / Personal',
    desc: 'Personal finance, household budgets, savings goals, investments',
    profiles: [
      {
        id: 'household',
        emoji: '🏠',
        title: 'Household & Family',
        desc: 'Day-to-day expenses, bills, and family savings',
        defaultVaultName: 'Family Vault',
        defaultVaultEmoji: '🏠',
        subVaults: [SV.daily, SV.bills, SV.savings, SV.emergency, SV.healthcare],
      },
      {
        id: 'investor',
        emoji: '📈',
        title: 'Active Investor',
        desc: 'Allocate across trading, yield, and long-term savings',
        defaultVaultName: 'Investment Vault',
        defaultVaultEmoji: '📈',
        subVaults: [SV.portfolio, SV.yield, SV.savings, SV.reserve, SV.fees],
      },
      {
        id: 'nomad',
        emoji: '🌐',
        title: 'Digital Nomad',
        desc: 'Multi-currency life: travel, remote work, and lean living',
        defaultVaultName: 'Nomad Vault',
        defaultVaultEmoji: '🌐',
        subVaults: [SV.daily, SV.travel, SV.income, SV.taxes, SV.emergency],
      },
    ],
  },
  {
    id: 'business',
    emoji: '🏢',
    title: 'Business',
    desc: 'Company treasury, payroll automation, operational spending controls',
    profiles: [
      {
        id: 'startup',
        emoji: '🚀',
        title: 'Startup',
        desc: 'Burn rate control, payroll, fundraising runway management',
        defaultVaultName: 'Company Treasury',
        defaultVaultEmoji: '🚀',
        subVaults: [SV.operations, SV.payroll, SV.rnd, SV.marketing, SV.reserve],
      },
      {
        id: 'smb',
        emoji: '🏪',
        title: 'SMB / E-commerce',
        desc: 'Inventory, supplier payments, marketing spend',
        defaultVaultName: 'Business Vault',
        defaultVaultEmoji: '🏪',
        subVaults: [SV.operations, SV.payroll, SV.marketing, SV.reserve, SV.taxes],
      },
      {
        id: 'defi_protocol',
        emoji: '⛓️',
        title: 'DeFi Protocol',
        desc: 'Protocol fees, grants, security budget, liquidity programs',
        defaultVaultName: 'Protocol Treasury',
        defaultVaultEmoji: '⛓️',
        subVaults: [SV.protocol, SV.dev, SV.security, SV.grants, SV.marketing],
      },
    ],
  },
  {
    id: 'dao',
    emoji: '🏛️',
    title: 'DAO',
    desc: 'Decentralised governance, on-chain treasury, contributor payments',
    profiles: [
      {
        id: 'grants_dao',
        emoji: '🤝',
        title: 'Grants DAO',
        desc: 'Fund external contributors, teams, and ecosystem projects',
        defaultVaultName: 'DAO Treasury',
        defaultVaultEmoji: '🏛️',
        subVaults: [SV.grants, SV.grantOps, SV.community, SV.reserve, SV.security],
      },
      {
        id: 'dev_dao',
        emoji: '💻',
        title: 'Dev DAO',
        desc: 'Engineering guilds, protocol upgrades, technical bounties',
        defaultVaultName: 'Dev DAO Vault',
        defaultVaultEmoji: '💻',
        subVaults: [SV.dev, SV.payroll, SV.security, SV.operations, SV.reserve],
      },
      {
        id: 'community_dao',
        emoji: '🌱',
        title: 'Community DAO',
        desc: 'Events, education, ambassador programs, content funding',
        defaultVaultName: 'Community DAO',
        defaultVaultEmoji: '🌱',
        subVaults: [SV.community, SV.grants, SV.marketing, SV.operations, SV.reserve],
      },
    ],
  },
  {
    id: 'creator',
    emoji: '🎨',
    title: 'Creator / Freelancer',
    desc: 'Income allocation, project budgets, tax reserves, equipment',
    profiles: [
      {
        id: 'content_creator',
        emoji: '📹',
        title: 'Content Creator',
        desc: 'Sponsorships, production costs, platform income',
        defaultVaultName: 'Creator Vault',
        defaultVaultEmoji: '🎨',
        subVaults: [SV.income, SV.equipment, SV.taxes, SV.savings, SV.marketing],
      },
      {
        id: 'freelancer',
        emoji: '💼',
        title: 'Freelancer / Consultant',
        desc: 'Client payments, project reserves, invoicing',
        defaultVaultName: 'Freelance Vault',
        defaultVaultEmoji: '💼',
        subVaults: [SV.income, SV.projects, SV.taxes, SV.equipment, SV.reserve],
      },
      {
        id: 'artist',
        emoji: '🖼️',
        title: 'Artist / NFT Creator',
        desc: 'Royalties, minting costs, collector relationships',
        defaultVaultName: 'Artist Vault',
        defaultVaultEmoji: '🖼️',
        subVaults: [SV.income, SV.nft, SV.equipment, SV.taxes, SV.savings],
      },
    ],
  },
  {
    id: 'fund',
    emoji: '💹',
    title: 'Investment Fund',
    desc: 'Portfolio management, fee collection, risk controls, LP capital',
    profiles: [
      {
        id: 'trading',
        emoji: '📊',
        title: 'Trading / Quant',
        desc: 'Algorithmic strategies, position sizing, fee collection',
        defaultVaultName: 'Fund Treasury',
        defaultVaultEmoji: '💹',
        subVaults: [SV.portfolio, SV.fees, SV.reserve, SV.operations, SV.security],
      },
      {
        id: 'yield_fund',
        emoji: '🌾',
        title: 'DeFi Yield Fund',
        desc: 'LP positions, staking strategies, yield optimisation',
        defaultVaultName: 'Yield Fund',
        defaultVaultEmoji: '🌾',
        subVaults: [SV.yield, SV.lp, SV.fees, SV.reserve, SV.operations],
      },
      {
        id: 'nft_fund',
        emoji: '🖼️',
        title: 'NFT / Collector Fund',
        desc: 'Acquisition budget, royalty flows, floor management',
        defaultVaultName: 'NFT Fund',
        defaultVaultEmoji: '🖼️',
        subVaults: [SV.nft, SV.fees, SV.reserve, SV.operations, SV.marketing],
      },
    ],
  },
  {
    id: 'nonprofit',
    emoji: '🤝',
    title: 'Non-profit / NGO',
    desc: 'Donation management, program funding, transparent reporting',
    profiles: [
      {
        id: 'humanitarian',
        emoji: '🌍',
        title: 'Humanitarian / Aid',
        desc: 'Direct relief programs, field operations, donor transparency',
        defaultVaultName: 'NGO Vault',
        defaultVaultEmoji: '🌍',
        subVaults: [SV.donations, SV.impact, SV.operations, SV.admin, SV.reserve],
      },
      {
        id: 'advocacy_org',
        emoji: '📢',
        title: 'Advocacy Organisation',
        desc: 'Policy campaigns, awareness programs, coalition building',
        defaultVaultName: 'Advocacy Vault',
        defaultVaultEmoji: '📢',
        subVaults: [SV.advocacy, SV.programs, SV.operations, SV.admin, SV.reserve],
      },
      {
        id: 'research',
        emoji: '🔬',
        title: 'Research / Education',
        desc: 'Research grants, scholarships, publications, conferences',
        defaultVaultName: 'Research Vault',
        defaultVaultEmoji: '🔬',
        subVaults: [SV.grants, SV.rnd, SV.programs, SV.operations, SV.reserve],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEntityDef(id: EntityType): EntityDefinition | undefined {
  return ENTITY_TYPES.find((e) => e.id === id);
}

export function getProfile(
  entityId: EntityType,
  profileId: string
): EntityProfile | undefined {
  return getEntityDef(entityId)?.profiles.find((p) => p.id === profileId);
}
