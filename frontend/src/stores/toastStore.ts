import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'danger' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  /** Optional single action (e.g. Undo). */
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss; 0 = sticky. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'tone' | 'duration'> & Partial<Pick<Toast, 'tone' | 'duration'>>) => string;
  dismiss: (id: string) => void;
}

let counter = 0;

/**
 * Toast queue (bottom-right, auto-dismiss). Client state — server state never
 * lives here. Consumed by the Toaster layer mounted once at the shell root.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ tone = 'default', duration = 3200, ...rest }) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, tone, duration, ...rest }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
