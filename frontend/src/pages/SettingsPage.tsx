import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HttpError } from '@/lib/api';
import { projectKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      navigate('/projects', { replace: true });
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        setDeleteError(err.body.message);
      } else {
        setDeleteError('Failed to delete project. Please try again.');
      }
    },
  });

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  const snippetCode = project
    ? `<script async src="https://logly.io/sdk/logly.min.js" data-tracking-id="${project.trackingId}"></script>`
    : '';

  const canDelete = project ? deleteConfirm === project.domain : false;

  return (
    <div className="max-w-3xl space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-xl border border-line p-5 animate-pulse h-32" />
            ))}
          </div>
        ) : project ? (
          <>
            {/* Project info */}
            <section className="bg-surface rounded-xl border border-line p-5">
              <h2 className="text-sm font-semibold text-fg-secondary mb-4">Project details</h2>
              <dl className="space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-line-subtle">
                  <dt className="text-sm text-fg-muted">Name</dt>
                  <dd className="text-sm text-fg font-medium">{project.name}</dd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-line-subtle">
                  <dt className="text-sm text-fg-muted">Domain</dt>
                  <dd className="text-sm text-fg font-mono">{project.domain}</dd>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-line-subtle">
                  <dt className="text-sm text-fg-muted">Tracking ID</dt>
                  <dd className="text-xs text-fg-secondary font-mono">{project.trackingId}</dd>
                </div>
                <div className="flex justify-between items-center py-1">
                  <dt className="text-sm text-fg-muted">Created</dt>
                  <dd className="text-sm text-fg-secondary">
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Tracking snippet */}
            <section className="bg-surface rounded-xl border border-line p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-fg-secondary">Tracking snippet</h2>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Add this to the <code className="bg-base px-1 rounded">&lt;head&gt;</code> of every page you want to track.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(snippetCode)}
                  className="text-xs text-accent hover:text-accent/80 transition flex-shrink-0"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-base rounded-lg p-3 text-xs text-fg-secondary font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {snippetCode}
              </pre>
              <p className="mt-3 text-xs text-fg-muted">
                The script is loaded asynchronously and will not block your page render.
                To track custom events, call{' '}
                <code className="bg-base px-1 rounded">
                  window.logly.track('EventName', {'{ key: "value" }'})
                </code>{' '}
                anywhere in your app.
              </p>
            </section>

            {/* Danger zone */}
            <section className="bg-surface rounded-xl border border-danger/30 p-5">
              <h2 className="text-sm font-semibold text-danger mb-1">Danger zone</h2>
              <p className="text-sm text-fg-secondary mb-4">
                Permanently delete this project and all its events, stats, and alerts.
                This action cannot be undone.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">
                    Type <span className="font-mono text-fg-secondary">{project.domain}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => {
                      setDeleteConfirm(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder={project.domain}
                    className="w-full rounded-lg bg-base border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-danger focus:border-transparent transition"
                  />
                </div>

                {deleteError && (
                  <div role="alert" className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
                    {deleteError}
                  </div>
                )}

                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!canDelete || deleteMutation.isPending}
                  className="rounded-lg bg-danger text-white hover:brightness-105 disabled:opacity-disabled disabled:cursor-not-allowed text-sm font-medium px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-danger"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete project permanently'}
                </button>
              </div>
            </section>
          </>
        ) : (
          <div className="text-center py-20 text-fg-muted text-sm">
            Project not found.{' '}
            <Link to="/projects" className="text-accent hover:underline">
              Go back
            </Link>
          </div>
        )}
    </div>
  );
}
