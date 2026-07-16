import { useI18n } from '../i18n';

export type TabId = 'message' | 'terminal' | 'tx';

const TABS: { id: TabId; key: string }[] = [
  { id: 'message', key: 'nav.message' },
  { id: 'terminal', key: 'nav.terminal' },
  { id: 'tx', key: 'nav.tx' },
];

export function Tabs({
  active,
  onChange,
  badges,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  badges?: Partial<Record<TabId, string>>;
}) {
  const { t } = useI18n();
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.key)}
          {badges?.[tab.id] && <span className="tab-badge">{badges[tab.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
