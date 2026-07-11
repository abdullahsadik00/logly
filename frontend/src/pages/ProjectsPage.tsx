import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HttpError } from '@/lib/api';
import { projectKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; domain: string }) =>
      api.post<Project>('/api/projects', body),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      setShowModal(false);
      setName('');
      setDomain('');
      navigate(`/projects/${newProject.id}`);
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        setFormError(err.body.message);
      } else {
        setFormError('Failed to create project. Please try again.');
      }
    },
  });

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Best-effort — clear local state regardless
    }
    logout();
    navigate('/login', { replace: true });
  }

  function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain) {
      setFormError('Enter a valid domain.');
      return;
    }

    createMutation.mutate({ name: name.trim(), domain: cleanDomain });
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top nav */}
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white tracking-tight">Logly</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Your projects</h1>
            <p className="text-sm text-slate-400 mt-0.5">Each project tracks one website or app.</p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setFormError(null);
            }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            + New project
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-5 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-2/3 mb-3" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
            Failed to load projects. Please refresh the page.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && projects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📊</p>
            <h2 className="text-lg font-semibold text-white mb-1">No projects yet</h2>
            <p className="text-sm text-slate-400 mb-6">
              Create your first project and drop the tracking script in your app.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 transition"
            >
              Create a project
            </button>
          </div>
        )}

        {/* Project cards */}
        {!isLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition"
              >
                <h2 className="font-semibold text-white text-base truncate">{project.name}</h2>
                <p className="text-sm text-slate-400 mt-0.5 truncate">{project.domain}</p>
                <p className="text-xs text-slate-600 mt-1 font-mono truncate">{project.trackingId}</p>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex-1 text-center rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-1.5 transition"
                  >
                    View Dashboard
                  </Link>
                  <Link
                    to={`/projects/${project.id}/settings`}
                    className="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-3 py-1.5 transition"
                    aria-label="Settings"
                  >
                    ⚙
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-5">New project</h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label htmlFor="proj-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Project name
                </label>
                <input
                  id="proj-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="My App"
                />
              </div>

              <div>
                <label htmlFor="proj-domain" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Domain
                </label>
                <input
                  id="proj-domain"
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="myapp.com"
                />
                <p className="mt-1 text-xs text-slate-500">Without https:// or trailing slash</p>
              </div>

              {formError && (
                <div role="alert" className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-slate-600 hover:border-slate-500 text-slate-300 text-sm font-medium py-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
