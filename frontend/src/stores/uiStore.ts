import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sidebar presentation mode. Driven by viewport (set by AppShell) but the
 * user's explicit collapse choice on desktop is persisted.
 */
export type SidebarMode = 'expanded' | 'collapsed';

interface SidebarState {
  mode: SidebarMode;
  /** Mobile drawer open/closed (not persisted — ephemeral per session). */
  mobileOpen: boolean;
  toggle: () => void;
  setMode: (mode: SidebarMode) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      mode: 'expanded',
      mobileOpen: false,
      toggle: () => set((s) => ({ mode: s.mode === 'expanded' ? 'collapsed' : 'expanded' })),
      setMode: (mode) => set({ mode }),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    }),
    {
      name: 'logly-sidebar',
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
);

interface CommandState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** ⌘K command palette visibility. */
export const useCommandStore = create<CommandState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
