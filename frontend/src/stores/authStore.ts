import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      setAuth: (user, token) => set({ user, token }),

      logout: () => {
        // Clear the persisted state as well
        set({ user: null, token: null });
      },
    }),
    {
      name: 'logly-auth',
      // Persist the user and token — not the action functions
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);
