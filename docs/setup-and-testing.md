# Setup & Testing

This guide walks through deploying hotdog-bot and verifying it works end-to-end.

---

## Prerequisites

- A **Meta Developer** account with an app configured for Instagram Messaging
- An **Instagram Professional** (Business or Creator) account connected to a Facebook Page
- A server running **Docker** and **Docker Compose** (or a [Dokploy](https://dokploy.com) instance)
- _(Optional)_ A [Resend](https://resend.com) account for email delivery
- _(For local development)_ [Bun](https://bun.sh) 1.x+

---

## 1. Meta App Setup

1. Go to the [Meta Developer Console](https://developers.facebook.com) and create (or select) your app.
2. Add the **Instagram** product to your app.
3. Generate a **Page Access Token** with the following permissions:
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `pages_messaging`
4. Note your **Instagram Page ID** (numeric) — find it under the Instagram settings in your app dashboard.
5. Under **App Settings → Basic**, copy the **App Secret** (this is `META_APP_SECRET`).
6. Choose a **Verify Token** — any string you want (this is `META_VERIFY_TOKEN`).

> You'll configure the webhook URL in step 4 after the app is running.

---

## 2. Deploy with Docker Compose

### Option A: Dokploy (recommended)

1. Push this repo to GitHub/GitLab.
2. In the Dokploy dashboard, create a new **Compose** project.
3. Point it at your repository.
4. In the **Environment** tab, add all required variables (see [Configuration](./configuration.md)).
5. Set a strong `POSTGRES_PASSWORD` (the example default is `hotdog` — change it in production).
6. Hit **Deploy**.
7. Enable **Isolated Deployments** under the Advanced tab.
8. In Dokploy's **Domains** tab, add your domain (e.g., `instabot.hotdog.photo`) pointing to service `app` on port `3000`. Dokploy handles TLS automatically.
9. **Redeploy** after adding the domain — compose services require a redeploy for domain changes to take effect.

### Option B: Manual Docker Compose

```bash
# Clone the repo
git clone https://github.com/your-org/hotdog-bot.git
cd hotdog-bot

# Configure environment
cp .env.example .env
# Edit .env with your real values — at minimum:
#   META_APP_SECRET, META_VERIFY_TOKEN, INSTAGRAM_PAGE_ACCESS_TOKEN,
#   INSTAGRAM_PAGE_ID, ADMIN_API_KEY, POSTGRES_PASSWORD
#   (default POSTGRES_PASSWORD is "hotdog" — change it for production)

# Start everything
docker compose up -d --build

# Watch logs
docker compose logs -f app
```

You should see:

```
info: Loaded keyword rules  {"count": 2}
info: Database initialized
info: Email reminder service started (checks every 60s)
info: hotdog-bot server started  {"port": 3000}
```

### Verify the health endpoint

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

---

## 3. Local Development (without Docker)

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env — point DATABASE_URL to a local or cloud Postgres instance

# Run in development mode (auto-reload on file changes)
bun run dev
```

The dev server uses Bun's built-in `--watch` mode and restarts automatically when you edit files in `src/`.

### Expose local server for webhooks

Use [ngrok](https://ngrok.com) to tunnel your local server to a public URL:

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL — you'll use it as your webhook URL.

---

## 4. Configure the Meta Webhook

1. In the Meta Developer Console, go to your app → **Instagram → Webhooks**.
2. Set the **Callback URL** to:
   - Dokploy: `https://instabot.hotdog.photo/webhook`
   - Local/ngrok: `https://xxxx.ngrok-free.app/webhook`
3. Set the **Verify Token** to the same value as your `META_VERIFY_TOKEN` env var.
4. Click **Verify and Save** — Meta sends a GET request to your `/webhook` endpoint; the app responds with the challenge token.
5. Subscribe to these webhook fields:
   - `messages`
   - `messaging_postbacks`

> **Note:** Comment-triggered DMs require subscribing to the `feed` webhook on the associated Facebook Page. Refer to the [Meta webhook docs](https://developers.facebook.com/docs/graph-api/webhooks/) for details.

---

## 5. Testing

### Smoke test — health check

```bash
curl https://instabot.hotdog.photo/health
# {"status":"ok"}
```

### Test keyword matching — send a DM

1. From a different Instagram account (not the bot's account), send a DM to the bot's Instagram account.
2. Type a trigger word — e.g., `🌭` or `WOOF`.
3. The bot should reply within a few seconds.

### Test via the webhook directly

You can simulate a webhook payload with curl. This is useful for testing without Instagram:

```bash
curl -X POST https://instabot.hotdog.photo/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<valid_signature>" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "<your_page_id>",
      "messaging": [{
        "sender": { "id": "TEST_USER_123" },
        "recipient": { "id": "<your_page_id>" },
        "timestamp": 1234567890,
        "message": {
          "mid": "test_mid_001",
          "text": "🌭"
        }
      }]
    }]
  }'
```

> **Tip:** To compute the correct `X-Hub-Signature-256`, HMAC-SHA256 the raw JSON body with your `META_APP_SECRET` as the key.

### Run the test suite

```bash
# Run all tests
bun test

# Run in watch mode
bun run test:watch
```

Tests use [Vitest](https://vitest.dev/) and cover keyword matching, cooldown logic, and handler behavior.

---

## 6. Troubleshooting

### App won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ZodError` on startup | Missing or invalid env vars | Check `.env` against the [Configuration docs](./configuration.md) |
| `ECONNREFUSED` to database | DB not ready or wrong `DATABASE_URL` | Make sure the `db` container is healthy: `docker compose ps` |
| `ENOTFOUND db` | Not running inside Docker network | If running locally (not in compose), use `localhost` instead of `db` in your `DATABASE_URL` |

### Webhook verification fails

- Make sure `META_VERIFY_TOKEN` in your `.env` matches exactly what you entered in the Meta Developer Console.
- Make sure the URL is correct and includes `/webhook` (not `/webhooks` or just `/`).
- Check logs: `docker compose logs app | grep verify`

### Bot doesn't reply to DMs

1. Check that your keyword rules are loaded: look for `Loaded keyword rules` in the logs.
2. Verify the message matches a rule — try `LOG_LEVEL=debug` for detailed matching traces.
3. Confirm your `INSTAGRAM_PAGE_ACCESS_TOKEN` is valid and hasn't expired.
4. Make sure you're messaging from a *different* account — Instagram doesn't deliver webhooks for messages you send to yourself.
5. Check cooldowns — the same user + keyword combo won't re-trigger within `cooldownMinutes`.

### Emails not sending

- Verify `RESEND_API_KEY` is set and valid.
- Make sure `EMAIL_FROM` uses a domain verified in your Resend account.
- Check logs for Resend API errors: `docker compose logs app | grep email`

---

## 7. Updating

### Change keyword rules

1. Edit `keywords.json`
2. Rebuild and redeploy:
   ```bash
   docker compose up -d --build
   ```

Or, if you've volume-mounted `keywords.json`, just restart the app container:

```bash
docker compose restart app
```

### Update the codebase

```bash
git pull
docker compose up -d --build
```

The database schema auto-migrates on boot (`CREATE TABLE IF NOT EXISTS`), so no manual migration steps are needed.
