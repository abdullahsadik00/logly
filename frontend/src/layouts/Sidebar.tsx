import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Lightbulb, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useCommandStore, useSidebarStore } from '@/stores/uiStore';
import { NAV_ITEMS, type NavItem, type NavGroup } from '@/layouts/nav';
import { ProjectSwitcher } from '@/layouts/ProjectSwitcher';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

// Demo badge values until the Realtime/Alerts cycles wire real data.
const DEMO_LIVE_COUNT = 46;
const DEMO_ALERT_COUNT = 2;

interface SidebarProps {
  projectId: string;
}

function NavRow({ item, projectId, collapsed }: { item: NavItem; projectId: string; collapsed: boolean }) {
  const Icon = item.icon;
  const to = item.to ? `/projects/${projectId}/${item.to}` : `/projects/${projectId}`;

  return (
    <NavLink
      to={to}
      end={item.to === ''}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md py-1.5 text-[13px] font-medium transition-colors',
          collapsed ? 'justify-center px-2' : 'px-2.5',
          isActive ? 'bg-surface-hover text-accent' : 'text-fg-secondary hover:bg-white/[0.04] hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 h-4 w-0.5 rounded-full bg-accent" />}
          <Icon size={16} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && item.badge === 'live' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {DEMO_LIVE_COUNT}
            </span>
          )}
          {!collapsed && item.badge === 'alerts' && (
            <Badge tone="danger" count>
              {DEMO_ALERT_COUNT}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
}

const GROUP_LABEL: Record<NavGroup, string> = { overview: 'Overview', explore: 'Explore' };

/** Persistent primary navigation (Dashboard V2 IA). */
export function Sidebar({ projectId }: SidebarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openCommand = useCommandStore((s) => s.setOpen);
  const collapsed = useSidebarStore((s) => s.mode === 'collapsed');

  const groups: NavGroup[] = ['overview', 'explore'];

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className={cn('p-3', collapsed && 'px-2')}>
        <ProjectSwitcher projectId={projectId} collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3" aria-label="Primary">
        {groups.map((group) => (
          <div key={group}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wide text-fg-faint">
                {GROUP_LABEL[group]}
              </p>
            )}
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                <NavRow key={item.to || 'index'} item={item} projectId={projectId} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-line-subtle p-3">
        <button
          type="button"
          onClick={() => openCommand(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md py-1.5 text-[13px] text-fg-secondary transition-colors hover:bg-white/[0.04] hover:text-fg',
            collapsed ? 'justify-center px-2' : 'px-2.5',
          )}
          title={collapsed ? 'Search' : undefined}
        >
          <Search size={16} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">⌘K</kbd>
            </>
          )}
        </button>

        <NavLink
          to={`/projects/${projectId}/setup`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md py-1.5 text-[13px] transition-colors',
              collapsed ? 'justify-center px-2' : 'px-2.5',
              isActive ? 'text-accent' : 'text-fg-secondary hover:bg-white/[0.04] hover:text-fg',
            )
          }
          title={collapsed ? 'Setup guide' : undefined}
        >
          <Lightbulb size={16} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && <span>Setup guide</span>}
        </NavLink>

        <NavLink
          to={`/projects/${projectId}/settings`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md py-1.5 text-[13px] transition-colors',
              collapsed ? 'justify-center px-2' : 'px-2.5',
              isActive ? 'text-accent' : 'text-fg-secondary hover:bg-white/[0.04] hover:text-fg',
            )
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <SettingsIcon size={16} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          type="button"
          onClick={() => navigate('/projects')}
          className={cn(
            'mt-1 flex w-full items-center gap-2.5 rounded-md py-1.5 transition-colors hover:bg-white/[0.04]',
            collapsed ? 'justify-center px-1' : 'px-2',
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">
            {(user?.email ?? 'U').slice(0, 2).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-fg">{user?.email ?? 'Account'}</span>
              <span className="block text-[11px] capitalize text-fg-muted">{user?.plan ?? 'free'} plan</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
