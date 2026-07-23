import path from 'path';
// Side-effect import: patches Express 4 so a `throw` inside an async route handler
// is routed to errorHandler instead of becoming an unhandled rejection that hangs
// the connection. Must be imported before any routes are registered.
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { collectRouter } from './routes/collect';
import { metricsRouter } from './routes/metrics';
import { eventsRouter } from './routes/events';
import { attributionRouter } from './routes/attribution';
import { stripeWebhookRouter } from './routes/stripeWebhook';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(compression());

// Stripe webhook MUST be mounted before the global JSON parser: it uses
// express.raw() (inside the router) so signature verification sees the exact
// bytes Stripe signed. If express.json() ran first it would re-serialize the
// body and every signature check would fail.
app.use('/api/stripe/webhook', stripeWebhookRouter);

app.use(express.json());

// CORS for regular API routes
const dashboardCors = cors({ origin: process.env.CORS_ORIGIN, credentials: true });
app.use('/api/auth', dashboardCors);
app.use('/api/projects', dashboardCors);

// Rate limit for everything except collect
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', apiLimiter);
app.use('/api/projects', apiLimiter);

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', metricsRouter);
app.use('/api/projects', eventsRouter);
app.use('/api/collect', collectRouter); // no rate limit, no global cors
app.use('/api/attribution', attributionRouter); // public (customer site/app); router has its own limiter

// Serve the tracking SDK as a public static asset. It is embedded via
// <script src> on third-party sites, so it must be loadable cross-origin:
// helmet's default Cross-Origin-Resource-Policy is "same-origin", which would
// block that — override to "cross-origin" for this path only.
// Path resolves to backend/public/sdk in both dev (src/..) and prod (dist/..).
app.use(
  '/sdk',
  express.static(path.join(__dirname, '..', 'public', 'sdk'), {
    maxAge: '1h',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Logly backend running on port ${PORT}`);
});

export { app };
