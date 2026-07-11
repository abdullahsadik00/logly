import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { projectKeys } from '@/lib/queryKeys';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';
import type { Project } from '@/types';

interface ProjectSwitcherProps {
  projectId: string;
  /** Icon-only when the sidebar is collapsed. */
  collapsed?: boolean;
}

/** Sidebar header: shows the current project and switches between projects. */
export function ProjectSwitcher({ projectId, collapsed = false }: ProjectSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const current = projects.find((p) => p.id === projectId);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => navigate('/projects')}
        aria-label="Switch project"
        className="flex w-full items-center justify-center py-1"
      >
        <Wordmark markOnly />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-line-subtle bg-surface px-2.5 py-2 text-left transition-colors hover:border-line"
      >
        <Wordmark markOnly />
        <span className="min-w-0 flex-1">
          {isLoading ? (
            <span className="block h-3.5 w-24 animate-pulse rounded bg-line" />
          ) : (
            <>
              <span className="block truncate text-[13px] font-semibold text-fg">
                {current?.domain ?? 'Select project'}
              </span>
              <span className="block text-[11px] text-fg-muted">Pro · Logly</span>
            </>
          )}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-fg-muted" strokeWidth={1.75} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-scrim cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 right-0 top-full z-palette mt-1.5 animate-lglin rounded-lg border border-line-strong bg-raised p-1 shadow-lg"
          >
            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-fg-faint">
              Projects
            </p>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate(`/projects/${p.id}`);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <span className="min-w-0 flex-1 truncate">{p.domain}</span>
                {p.id === projectId && <Check size={14} className="text-accent" strokeWidth={2} />}
              </button>
            ))}
            <div className="my-1 h-px bg-line-subtle" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/projects');
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]',
                'text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg',
              )}
            >
              <Plus size={14} strokeWidth={1.75} />
              All projects
            </button>
          </div>
        </>
      )}
    </div>
  );
}
