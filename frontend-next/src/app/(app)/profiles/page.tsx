'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { useContacts, CATEGORY_META, type ContactCategory } from '@/hooks/useContacts';
import { useI18n } from '@/context/I18nContext';
import { ProfileCard } from '@/components/profiles/ProfileCard';

const ALL_FILTER = '__all__';

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: active ? 'var(--primary)' : 'var(--card-mid)',
        color:      active ? '#fff'           : 'var(--text-muted)',
        border:     active ? '1px solid transparent' : '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  );
}

export default function ProfilesPage() {
  const { chainId } = useWeb3();
  const { contacts } = useContacts();
  const { t } = useI18n();

  const [query, setQuery]               = useState('');
  const [searchAddr, setSearchAddr]     = useState<string | null>(null);
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ContactCategory | typeof ALL_FILTER>(ALL_FILTER);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    setSearchError(null);
    if (!trimmed) { setSearchAddr(null); return; }
    if (ethers.isAddress(trimmed)) {
      setSearchAddr(ethers.getAddress(trimmed));
    } else {
      setSearchError(t('profiles.search.invalid'));
      setSearchAddr(null);
    }
  };

  const filteredContacts = useMemo(
    () => activeFilter === ALL_FILTER ? contacts : contacts.filter((c) => c.category === activeFilter),
    [contacts, activeFilter]
  );

  const showSearchResult = searchAddr !== null && !contacts.some((c) => c.address.toLowerCase() === searchAddr.toLowerCase());

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{t('profiles.title')}</h1>
        <p className="mt-xs" style={{ color: 'var(--text-muted)' }}>{t('profiles.subtitle')}</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch}>
        <div className="flex gap-sm">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(null); }}
              placeholder={t('profiles.search.placeholder')}
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'var(--card-mid)',
                border: searchError ? '1px solid var(--blocked)' : '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {t('profiles.search.btn')}
          </button>
        </div>
        {searchError && (
          <p className="text-xs mt-1 ml-1" style={{ color: 'var(--blocked)' }}>{searchError}</p>
        )}
        <p className="text-xs mt-1 ml-1" style={{ color: 'var(--text-muted)' }}>{t('profiles.search.hint')}</p>
      </form>

      {showSearchResult && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('profiles.search.result')}
          </p>
          <div className="max-w-sm">
            <ProfileCard address={searchAddr!} chainId={chainId} />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-md mb-4 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {t('profiles.contacts.title')}
            {contacts.length > 0 && (
              <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                ({contacts.length})
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={activeFilter === ALL_FILTER} onClick={() => setActiveFilter(ALL_FILTER)}>
              {t('profiles.filter.all')}
            </FilterPill>
            {(Object.entries(CATEGORY_META) as [ContactCategory, typeof CATEGORY_META[ContactCategory]][])
              .filter(([key]) => key !== 'untagged')
              .map(([key, meta]) => (
                <FilterPill key={key} active={activeFilter === key} onClick={() => setActiveFilter(key)}>
                  {meta.emoji} {t(meta.labelKey as Parameters<typeof t>[0])}
                </FilterPill>
              ))}
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed py-12 text-center space-y-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-3xl">👥</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {contacts.length === 0 ? t('profiles.contacts.empty') : t('profiles.contacts.empty_filter')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {filteredContacts
              .slice()
              .sort((a, b) => b.addedAt - a.addedAt)
              .map((contact) => (
                <ProfileCard key={contact.address} address={contact.address} chainId={chainId} cachedContact={contact} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
