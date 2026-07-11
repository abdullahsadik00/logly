import { useToastStore } from '@/stores/toastStore';

/**
 * Imperative toast API. Usage: `const toast = useToast(); toast.success('Saved')`.
 * Thin wrapper over the store so callers don't reach into it directly.
 */
export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);

  return {
    show: push,
    success: (title: string, description?: string) => push({ title, description, tone: 'success' }),
    error: (title: string, description?: string) => push({ title, description, tone: 'danger', duration: 5000 }),
    warning: (title: string, description?: string) => push({ title, description, tone: 'warning' }),
    dismiss,
  };
}
