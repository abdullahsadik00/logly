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
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(compression());
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

app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Logly backend running on port ${PORT}`);
});

export { app };
