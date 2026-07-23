import jwt from 'jsonwebtoken';

// Never fall back to a hardcoded secret in production — a known secret means
// anyone can forge a valid token. Fail fast at boot instead. In dev we allow a
// loud, insecure fallback so `npm run dev` works without a .env.
const SECRET: string =
  process.env.JWT_SECRET ??
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    console.warn(
      '[jwt] JWT_SECRET is not set — using an INSECURE dev-only fallback. ' +
        'Set JWT_SECRET in backend/.env before deploying.',
    );
    return 'dev-insecure-secret-change-me';
  })();

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string } {
  const payload = jwt.verify(token, SECRET) as { sub: string };
  return { sub: payload.sub };
}
