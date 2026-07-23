import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface RealtimeCountProps {
  projectId: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export default function RealtimeCount({ projectId }: RealtimeCountProps) {
  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      // EventSource can't send an Authorization header, so pass the JWT as a
      // query param — the SSE route authenticates from ?token=.
      const token = useAuthStore.getState().token;
      const url = `${BASE_URL}/api/projects/${projectId}/metrics/realtime?token=${encodeURIComponent(token ?? '')}`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        if (!destroyed) setConnected(true);
      };

      es.onmessage = (event: MessageEvent<string>) => {
        if (destroyed) return;
        try {
          const data = JSON.parse(event.data) as { count: number };
          setCount(data.count);
        } catch {
          // Malformed SSE data — ignore silently
        }
      };

      es.onerror = () => {
        if (destroyed) return;
        setConnected(false);
        es.close();
        esRef.current = null;

        // Reconnect after 5 seconds — EventSource reconnects automatically but
        // we handle it manually so we can control the reconnect delay
        reconnectTimerRef.current = setTimeout(() => {
          if (!destroyed) connect();
        }, 5_000);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [projectId]);

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5">
      {/* Pulsing accent dot */}
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-accent' : 'bg-line-strong'}`} />
      </span>

      <span className="text-sm text-fg-secondary">
        {count === null ? (
          <span className="text-fg-muted">Connecting…</span>
        ) : (
          <>
            <span className="font-semibold text-fg">{count}</span>{' '}
            {count === 1 ? 'visitor' : 'visitors'} right now
          </>
        )}
      </span>
    </div>
  );
}
