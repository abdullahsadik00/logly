import { useLocation } from 'react-router-dom';
import { PanelLeft, Menu, Download, Plus } from 'lucide-react';
import { useSidebarStore } from '@/stores/uiStore';
import { useToast } from '@/hooks/useToast';
import { titleForSegment } from '@/layouts/nav';
import { Button } from '@/components/ui';

interface TopBarProps {
  projectId: string;
}

/** Derive the project-relative segment (`''` for the dashboard index). */
function useSegment(projectId: string): string {
  const { pathname } = useLocation();
  const prefix = `/projects/${projectId}`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length).replace(/^\//, '') : '';
  return rest.split('/')[0] ?? '';
}

export function TopBar({ projectId }: TopBarProps) {
  const segment = useSegment(projectId);
  const title = titleForSegment(segment);
  const toggle = useSidebarStore((s) => s.toggle);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const toast = useToast();

  return (
    <header className="sticky top-0 z-scrim flex h-14 items-center gap-3 border-b border-line-subtle bg-base/90 px-4 backdrop-blur">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg lg:hidden"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="hidden rounded-md p-1.5 text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg lg:block"
      >
        <PanelLeft size={18} strokeWidth={1.75} />
      </button>

      <h1 className="text-[15px] font-semibold text-fg">{title}</h1>

      {/* Connection state — static "Demo data" until the realtime layer lands. */}
      <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Demo data
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Download size={14} strokeWidth={1.75} />}
          onClick={() => toast.show({ title: 'Export coming soon', description: 'CSV / PNG / PDF exports arrive with the analytics cycle.' })}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<Plus size={14} strokeWidth={2} />}
          onClick={() => toast.show({ title: 'Reports coming soon' })}
        >
          New report
        </Button>
      </div>
    </header>
  );
}
