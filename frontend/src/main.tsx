import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { seedDevAuthIfEnabled } from '@/lib/devAuth';
import './index.css';

// Dev-only: seed a demo session so the login wall doesn't block UI work.
// No-op (tree-shaken) in production builds.
seedDevAuthIfEnabled();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't re-fetch on window focus in an analytics dashboard — it's noisy
      refetchOnWindowFocus: false,
      // Retry once on failure — most transient errors resolve on retry
      retry: 1,
      // Keep data fresh for 30 seconds by default
      staleTime: 30_000,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
