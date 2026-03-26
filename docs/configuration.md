# Configuration

hotdog-bot is configured entirely via environment variables. All variables are validated at startup using [Zod](https://zod.dev/) — the app will refuse to start if required values are missing or malformed.

Copy the example file to get started:

```bash
cp .env.example .env
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `META_APP_SECRET` | Your Meta app secret. Used to verify webhook request signatures (HMAC-SHA256). Found in your Meta app dashboard under **Settings → Basic**. |
| `META_VERIFY_TOKEN` | A string you choose. Meta sends it during webhook setup to confirm you own the endpoint. Can be any value — just make sure it matches what you enter in the Meta Developer Console. |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | A long-lived page access token for the Instagram account. Generated via the Meta Graph API Explorer or your app's token tool. |
| `INSTAGRAM_PAGE_ID` | The numeric ID of your Instagram Professional account (not the username). |
| `ADMIN_API_KEY` | A secret key you choose. Required by the env schema but not currently used by any route — reserved for future admin endpoints. |
| `DATABASE_URL` | PostgreSQL connection string. When using the included `docker-compose.yml`, this is set automatically by the compose environment block (uses the `db` service as the host). Format: `postgresql://user:password@host:5432/dbname` |
| `POSTGRES_PASSWORD` | Password for the Postgres container. Referenced by both the `db` service and the `DATABASE_URL` in `docker-compose.yml`. |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the Bun server listens on. |
| `NODE_ENV` | `development` | Set to `production` in deployment. Affects logging format and error detail. |
| `LOG_LEVEL` | `info` | Pino log level. One of: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `RESEND_API_KEY` | _(disabled)_ | API key from [Resend](https://resend.com). When omitted, all email features (welcome email, resource delivery, reminders) are disabled. |
| `EMAIL_FROM` | `Hotdog Photo <hello@hotdog.photo>` | The "From" address for outgoing emails. Must be a verified sender in your Resend account. |
| `WELCOME_EMAIL_TEMPLATE` | `welcome-generic.html` | Filename of the HTML template in `email-templates/` used for the welcome email. |

---

## Database

The app uses PostgreSQL via the [`postgres`](https://www.npmjs.com/package/postgres) package. On every boot, `initDb()` runs `CREATE TABLE IF NOT EXISTS` for two tables:

- **`leads`** — Captured contacts (IG user ID, username, email, phone, source keyword, status, timestamps)
- **`dm_log`** — Audit log of all DMs sent and received (direction, message type, keyword, content, timestamp)

No manual migrations are needed — the schema is self-managed.

### Connection String

When using Docker Compose, the `DATABASE_URL` is constructed in `docker-compose.yml`:

```
postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/hotdog
```

The `db` hostname resolves to the Postgres container on the Docker network. If you're using an external database (e.g., Supabase, Neon, Railway Postgres), set `DATABASE_URL` directly in your `.env` and remove or ignore the `db` service in compose.

---

## Email

Email features require a [Resend](https://resend.com) account and API key. When `RESEND_API_KEY` is set:

- **Welcome email** — Sent when a user provides their email address through the DM flow
- **Resource email** — Sent alongside the follow-up DM with the resource link
- **10-minute reminder** — A background scheduler checks for leads who were asked for their email but haven't replied; sends a gentle nudge DM

### Email Templates

Templates live in `email-templates/`. The default is `welcome-generic.html`, which is Hotdog-branded and uses:

- `{{1.record.full_name}}` — Replaced with the user's name

To create a custom template:
1. Add an HTML file to `email-templates/`
2. Set `WELCOME_EMAIL_TEMPLATE=your-template.html` in `.env`
3. Rebuild/redeploy (templates are baked into the Docker image)

---

## Cooldowns & Rate Limits

Two layers of protection prevent spamming users:

1. **Per-keyword cooldown** — Defined in `keywords.json` per rule via `cooldownMinutes`. A user won't re-trigger the same rule within the cooldown window.
2. **Global rate limit** — Max 30 DMs per hour per user across all keywords. Hardcoded in `cooldown.service.ts`.

Both are tracked in-memory and reset on restart.

---

## Logging

The app uses [Pino](https://getpino.io/) for structured JSON logging. Control verbosity with `LOG_LEVEL`:

| Level | What you'll see |
|-------|----------------|
| `error` | Only errors |
| `warn` | Errors + warnings |
| `info` | Normal operation logs (keyword matches, DMs sent, DB init) |
| `debug` | Detailed flow tracing |
| `trace` | Everything, including raw payloads |

In production, `info` is recommended. Use `debug` or `trace` when troubleshooting webhook delivery or keyword matching issues.
