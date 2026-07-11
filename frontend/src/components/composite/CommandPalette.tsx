import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useCommandStore } from '@/stores/uiStore';
import { NAV_ITEMS } from '@/layouts/nav';
import { cn } from '@/lib/cn';

interface Command {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: typeof Search;
}

/** ⌘K palette — navigate between pages/sections. Keyboard: ↑↓ move, ↵ go, esc close. */
export function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    if (!id) return [];
    const base = `/projects/${id}`;
    return NAV_ITEMS.map((n) => ({
      id: n.to || 'dashboard',
      label: n.label,
      hint: 'Go to',
      to: n.to ? `${base}/${n.to}` : base,
      icon: n.icon,
    }));
  }, [id]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  // Reset transient state whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after paint so the element exists.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function go(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    navigate(command.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="fixed inset-0 z-palette flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 animate-lglin bg-black/60"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg animate-lglin overflow-hidden rounded-xl border border-line-strong bg-raised shadow-xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-4">
          <Search size={16} className="text-fg-muted" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Navigate Logly…"
            className="w-full bg-transparent py-3.5 text-sm text-fg placeholder-fg-faint focus:outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label="Results">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches</li>
          ) : (
            results.map((c, i) => {
              const Icon = c.icon;
              return (
                <li key={c.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors',
                      i === active ? 'bg-surface-hover text-fg' : 'text-fg-secondary',
                    )}
                  >
                    <Icon size={15} strokeWidth={1.75} className="text-fg-muted" />
                    <span className="text-fg-faint">{c.hint}</span>
                    <span className="font-medium">{c.label}</span>
                    {i === active && (
                      <CornerDownLeft size={13} className="ml-auto text-fg-faint" strokeWidth={1.75} />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
