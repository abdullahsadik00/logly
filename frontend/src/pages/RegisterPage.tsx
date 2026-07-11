import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, HttpError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, Input } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import type { AuthResponse } from '@/types';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const { user, token } = await api.post<AuthResponse>('/api/auth/register', {
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
          <p className="mt-2 text-sm text-fg-muted">Privacy-first analytics</p>
        </div>

        <Card className="p-6 shadow-lg">
          <h1 className="mb-6 text-base font-semibold text-fg">Create your account</h1>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              hint="Minimum 8 characters"
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
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-fg-muted">
            No cookies. No PII stored. Analytics done right.
          </p>
        </Card>

        <p className="mt-4 text-center text-sm text-fg-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent transition-colors hover:brightness-110">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
