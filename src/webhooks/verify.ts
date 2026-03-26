import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Verify the Meta webhook signature.
 * Returns a Response if verification fails, or null if valid.
 */
export function verifySignature(req: Request, rawBody: string): Response | null {
  const signature = req.headers.get('x-hub-signature-256');

  if (!signature) {
    logger.warn('Missing X-Hub-Signature-256 header');
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const env = getEnv();
  const expectedSignature =
    'sha256=' + createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warn('Invalid webhook signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  return null;
}

export function computeSignature(secret: string, payload: string | Buffer): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}
