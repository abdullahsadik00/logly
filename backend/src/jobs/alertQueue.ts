import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';

// BullMQ bundles its own ioredis — pass connection config, not a Redis instance
function getRedisConfig() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: url.hostname, port: parseInt(url.port || '6379') };
}

export const alertQueue = new Queue('alerts', {
  connection: getRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

interface AlertJobData {
  projectName: string;
  emails: string[];
  type: 'spike' | 'drop';
  currentViews: number;
  previousViews: number;
  changePct: number;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildEmailContent(data: AlertJobData): { subject: string; html: string } {
  if (data.type === 'spike') {
    return {
      subject: `Traffic spike on ${data.projectName} (+${data.changePct}%)`,
      html: `
        <h2>Your site is getting a lot of traffic!</h2>
        <p><strong>${data.projectName}</strong> is seeing a traffic spike.</p>
        <ul>
          <li>Current views today: <strong>${data.currentViews.toLocaleString()}</strong></li>
          <li>Yesterday's views: <strong>${data.previousViews.toLocaleString()}</strong></li>
          <li>Change: <strong>+${data.changePct}%</strong></li>
        </ul>
        <p>Log in to <a href="http://localhost:5173">Logly</a> to see real-time analytics.</p>
      `,
    };
  }

  return {
    subject: `Traffic drop on ${data.projectName} (${data.changePct}%)`,
    html: `
      <h2>Traffic has dropped significantly</h2>
      <p><strong>${data.projectName}</strong> is experiencing a traffic drop.</p>
      <ul>
        <li>Current views today: <strong>${data.currentViews.toLocaleString()}</strong></li>
        <li>Yesterday's views: <strong>${data.previousViews.toLocaleString()}</strong></li>
        <li>Change: <strong>${data.changePct}%</strong></li>
      </ul>
      <p>Log in to <a href="http://localhost:5173">Logly</a> to investigate.</p>
    `,
  };
}

export function startAlertWorker() {
  const worker = new Worker<AlertJobData>(
    'alerts',
    async (job) => {
      const data = job.data;
      console.log(
        `[AlertWorker] Sending ${data.type} alert for ${data.projectName} to ${data.emails.join(', ')}`
      );

      const transporter = createTransporter();
      const { subject, html } = buildEmailContent(data);

      await transporter.sendMail({
        from: `"Logly Alerts" <${process.env.SMTP_USER ?? 'alerts@logly.dev'}>`,
        to: data.emails.join(', '),
        subject,
        html,
      });

      console.log(`[AlertWorker] Alert sent for ${data.projectName}`);
    },
    {
      connection: getRedisConfig(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[AlertWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[AlertWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
