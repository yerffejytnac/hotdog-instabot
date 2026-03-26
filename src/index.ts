import { loadEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadKeywordRules } from './services/keyword.service.js';
import { initDb } from './services/db.js';
import { startEmailReminder } from './services/reminder.service.js';
import { handleWebhookGet, handleWebhookPost } from './webhooks/router.js';

// Load and validate env vars
const env = loadEnv();

// Load keyword rules
loadKeywordRules();

// Initialize database, then start server
await initDb();
startEmailReminder();

const server = Bun.serve({
  port: env.PORT,
  hostname: '0.0.0.0',

  async fetch(req: Request) {
    const url = new URL(req.url);

    // Health endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      return Response.json({
        status: 'ok',
        uptime: process.uptime(),
        version: '1.0.0',
      });
    }

    // Webhook routes
    if (url.pathname === '/webhook') {
      if (req.method === 'GET') return handleWebhookGet(req, url);
      if (req.method === 'POST') return handleWebhookPost(req);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

logger.info({ port: server.port, env: env.NODE_ENV }, 'Hotdog InstaBot server started');

export { server };
