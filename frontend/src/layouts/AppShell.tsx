import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useCommandStore, useSidebarStore } from '@/stores/uiStore';
import { Sidebar } from '@/layouts/Sidebar';
import { TopBar } from '@/layouts/TopBar';
import { Toaster } from '@/components/ui/Toaster';
import { CommandPalette } from '@/components/composite/CommandPalette';
import { cn } from '@/lib/cn';

/**
 * Authenticated app shell: persistent sidebar + topbar around a routed Outlet,
 * with the toast and command-palette overlay layers mounted once at the root.
 */
export function AppShell() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const collapsed = useSidebarStore((s) => s.mode === 'collapsed');
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const toggleCommand = useCommandStore((s) => s.toggle);

  // Global ⌘K / Ctrl+K opens the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCommand]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="flex min-h-screen bg-base text-fg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-line-subtle transition-[width] duration-base ease-brand lg:block',
          collapsed ? 'w-16' : 'w-[236px]',
        )}
      >
        <Sidebar projectId={projectId} />
      </aside>

      {/* Mobile off-canvas sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-palette lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 animate-lglin bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[236px] animate-lglslide border-r border-line-subtle">
            <Sidebar projectId={projectId} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar projectId={projectId} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <Toaster />
      <CommandPalette />
    </div>
  );
}
