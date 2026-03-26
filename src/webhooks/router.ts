import { getEnv } from "../config/env.js";
import { handleComment } from "../handlers/comment.handler.js";
import { handleMention } from "../handlers/mention.handler.js";
import { handleMessage } from "../handlers/message.handler.js";
import { handlePostback } from "../handlers/postback.handler.js";
import type { MetaWebhookPayload } from "../types/meta.types.js";
import { logger } from "../utils/logger.js";
import { parseWebhookPayload } from "./parser.js";
import { verifySignature } from "./verify.js";

// GET /webhook — Meta verification challenge
export function handleWebhookGet(_req: Request, url: URL): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === getEnv().META_VERIFY_TOKEN) {
    logger.info("Webhook verification successful");
    return new Response(challenge, { status: 200 });
  }

  logger.warn({ mode, token }, "Webhook verification failed");
  return new Response("Forbidden", { status: 403 });
}

// POST /webhook — Receive events
export async function handleWebhookPost(req: Request): Promise<Response> {
  const rawBody = await req.text();

  // Verify signature
  const signatureError = verifySignature(req, rawBody);
  if (signatureError) return signatureError;

  // Respond 200 immediately — process events async
  const payload: MetaWebhookPayload = JSON.parse(rawBody);

  setImmediate(() => {
    try {
      const events = parseWebhookPayload(payload);
      logger.info({ eventCount: events.length }, "Processing webhook events");

      for (const event of events) {
        switch (event.type) {
          case "comment":
            handleComment(event.data).catch((err) =>
              logger.error(
                { err, event: event.data },
                "Error handling comment",
              ),
            );
            break;
          case "message":
            handleMessage(event.data).catch((err) =>
              logger.error({ err }, "Error handling message"),
            );
            break;
          case "postback":
            handlePostback(event.data).catch((err) =>
              logger.error({ err }, "Error handling postback"),
            );
            break;
          case "mention":
            handleMention(event.data).catch((err) =>
              logger.error({ err }, "Error handling mention"),
            );
            break;
        }
      }
    } catch (err) {
      logger.error({ err }, "Error parsing webhook payload");
    }
  });

  return new Response("EVENT_RECEIVED", { status: 200 });
}
