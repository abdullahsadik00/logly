import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/layouts/AppShell';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProjectsPage from '@/pages/ProjectsPage';
import DashboardPage from '@/pages/DashboardPage';
import EventsPage from '@/pages/EventsPage';
import SettingsPage from '@/pages/SettingsPage';
import SectionPlaceholder from '@/pages/SectionPlaceholder';

/** Redirects unauthenticated users to /login */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Redirects authenticated users away from auth pages */
function GuestRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user) {
    return <Navigate to="/projects" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/projects" replace />} />

      {/* Auth routes — redirect to /projects if already logged in */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        }
      />

      {/* Project list (pre-selection, no app shell) */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />

      {/* Project-scoped app — everything mounts inside the persistent AppShell */}
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Sections built in later cycles — nav is fully wired via placeholders */}
        <Route path="realtime" element={<SectionPlaceholder />} />
        <Route path="goals" element={<SectionPlaceholder />} />
        <Route path="alerts" element={<SectionPlaceholder />} />
        <Route path="pages" element={<SectionPlaceholder />} />
        <Route path="sources" element={<SectionPlaceholder />} />
        <Route path="locations" element={<SectionPlaceholder />} />
        <Route path="devices" element={<SectionPlaceholder />} />
        <Route path="setup" element={<SectionPlaceholder />} />
      </Route>

      {/* Fallback 404 */}
      <Route
        path="*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-base text-fg-muted">
            <div className="text-center">
              <p className="text-6xl font-bold text-line-strong">404</p>
              <p className="mt-2">Page not found</p>
              <a href="/projects" className="mt-4 inline-block text-accent hover:brightness-110">
                Go home
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
