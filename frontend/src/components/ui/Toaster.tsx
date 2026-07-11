import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastTone } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

const TONE_ICON: Record<ToastTone, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
};

const TONE_COLOR: Record<ToastTone, string> = {
  default: 'text-fg-secondary',
  success: 'text-accent',
  danger: 'text-danger',
  warning: 'text-warning',
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = TONE_ICON[toast.tone];

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-[320px] animate-lglin items-start gap-3 rounded-lg border border-line-strong bg-surface-hover px-3.5 py-3 shadow-lg"
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', TONE_COLOR[toast.tone])} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-xs text-fg-muted">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
            className="mt-2 text-xs font-medium text-accent transition-[filter] hover:brightness-110"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 shrink-0 rounded-sm p-1 text-fg-muted transition-colors hover:text-fg"
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Toast layer — mounted once at the shell root. Announces via role="status". */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-toast flex flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
