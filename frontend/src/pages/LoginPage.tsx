import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, HttpError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, Input } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import type { AuthResponse } from '@/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user, token } = await api.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      });
      setAuth(user, token);
      navigate('/projects', { replace: true });
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.body.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="justify-center" />
          <p className="mt-2 text-sm text-fg-muted">Decide what to do right now.</p>
        </div>

        <Card className="p-6 shadow-lg">
          <h1 className="mb-6 text-base font-semibold text-fg">Sign in to your account</h1>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}

            <Button type="submit" variant="success" size="lg" loading={loading} className="w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-fg-muted">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-accent transition-colors hover:brightness-110">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
