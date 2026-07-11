import { useAuthStore } from '@/stores/authStore';

/**
 * Dev-only login bypass. When running the Vite dev server it seeds a demo
 * session so you never hit the login wall while building the UI.
 *
 * Safety:
 *  - Wrapped in `import.meta.env.DEV`, so the whole body is dead code in a
 *    production build (`vite build` sets DEV=false) and gets tree-shaken out.
 *  - Never overwrites a real session — only seeds when the store is empty.
 *  - Opt out at any time with `VITE_DEV_AUTOLOGIN=false` in `.env.local`
 *    (e.g. to test the real login/register screens).
 */
export function seedDevAuthIfEnabled(): void {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_DEV_AUTOLOGIN === 'false') return;

  const { user, setAuth } = useAuthStore.getState();
  if (user) return; // respect an existing (real or previously-seeded) session

  setAuth(
    { id: 'dev-user', email: 'dev@logly.app', plan: 'pro' },
    'dev-token',
  );
  // eslint-disable-next-line no-console
  console.info('[dev] auto-login enabled — set VITE_DEV_AUTOLOGIN=false to disable.');
}
