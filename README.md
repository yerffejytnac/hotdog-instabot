# hotdog-bot 🌭📸

**Open-source ManyChat alternative. Self-hosted Instagram DM automation.**

Replace your $50/month ManyChat subscription with a self-hosted server that does keyword-triggered DMs, email collection, and resource delivery — all running on Dokploy (or any Docker host).

---

## Features

- **Keyword-triggered DMs** — Someone comments a keyword on your post, they get a DM automatically
- **3 match types** — `exact`, `contains`, or `word_boundary` (regex) matching
- **Conversational email flow** — CTA button → ask for email → 10-min reminder → deliver resource
- **Returning user detection** — Recognizes users who already gave their email, asks to confirm or update
- **Email delivery** — Send resource links + welcome emails via Resend
- **Story mention replies** — Auto-reply when someone mentions you in their story
- **Ice Breaker support** — Works with Instagram's native conversation starters
- **Cooldowns & rate limits** — Per-keyword cooldowns + global rate limiting
- **PostgreSQL** — Leads, DM logs, and email status tracked in a database
- **Docker Compose deploy** — `docker-compose.yml` included, ready for Dokploy

## How It Works

```/dev/null/flow.txt#L1-7
User sends "🌭" or "WOOF" via DM (or comments on a post)
        │
        ▼
hotdog-bot matches keyword → sends DM response
        │  (optionally)
        ▼
Bot asks for email → user replies → resource delivered via DM + email
```

## Quick Start

### 1. Clone and install

```/dev/null/bash.sh#L1-3
git clone https://github.com/your-org/hotdog-bot.git
cd hotdog-bot
bun install
```

### 2. Configure environment

```/dev/null/bash.sh#L1-2
cp .env.example .env
# Edit .env with your Meta API credentials, Postgres password, etc.
```

### 3. Set up your keywords

Edit `keywords.json` to define your automation rules. Two rules are included out of the box:

| Keyword | Trigger | Description |
|---------|---------|-------------|
| `hotdog` | 🌭 emoji | Plain text reply |
| `woof` | WOOF | Plain text reply |

See [docs/keywords.md](docs/keywords.md) for the full schema, match types, and examples including email collection flows.

### 4. Deploy to Dokploy

This project ships with a `docker-compose.yml` ready for [Dokploy's Docker Compose deployment mode](https://docs.dokploy.com/docs/core/docker-compose).

#### Option A: Deploy via Dokploy UI

1. In the Dokploy dashboard, create a new **Compose** project
2. Point it to your Git repository
3. Add your environment variables in the Dokploy **Environment** tab (see table below)
4. Set `POSTGRES_PASSWORD` to a strong, unique value
5. Deploy — Dokploy builds the image, starts Postgres, and wires everything up
6. Enable **Isolated Deployments** under the Advanced tab
7. In the **Domains** tab, add your domain (e.g., `instabot.hotdog.photo`) pointing to service `app` on port `3000`
8. **Redeploy** after adding the domain — compose services require a redeploy for domain changes to take effect

#### Option B: Deploy manually with Docker Compose

```/dev/null/bash.sh#L1-5
# On your server:
cp .env.example .env
# Edit .env with real values
docker compose up -d --build
docker compose logs -f app
```

### 5. Configure Meta Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com)
2. Set webhook URL to `https://your-domain.com/webhook`
3. Subscribe to: `messages`, `messaging_postbacks`

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `META_APP_SECRET` | Yes | Your Meta app secret (for webhook signature verification) |
| `META_VERIFY_TOKEN` | Yes | Token you choose for webhook verification |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | Yes | Instagram page access token |
| `INSTAGRAM_PAGE_ID` | Yes | Your Instagram page/account ID |
| `DATABASE_URL` | Yes | PostgreSQL connection string (set automatically by compose) |
| `POSTGRES_PASSWORD` | Yes | Password for the Postgres container |
| `ADMIN_API_KEY` | Yes | Required by env schema, reserved for future admin endpoints |
| `PORT` | No | Server port (default: 3000) |
| `RESEND_API_KEY` | No | Resend API key (enables email features) |
| `EMAIL_FROM` | No | Sender address (default: `Hotdog Photo <hello@hotdog.photo>`) |
| `WELCOME_EMAIL_TEMPLATE` | No | Email template filename in `email-templates/` (default: `welcome.html`) |

### Keyword Match Types

| Type | Behavior | Example |
|------|----------|---------|
| `exact` | Full text must match | "WOOF" matches "WOOF" only |
| `contains` | Keyword anywhere in text | "WOOF" matches "hey WOOF!" |
| `word_boundary` | Whole word match | "BOOK" matches "I want to BOOK" but not "FACEBOOK" |

All matching is case-insensitive.

### Email Templates

A welcome email template is included in `email-templates/`:

- `welcome.html` — Hotdog-branded welcome email (default)

The template uses `{{1.record.full_name}}` as the name placeholder. To create your own, add an HTML file to `email-templates/` and set `WELCOME_EMAIL_TEMPLATE` in your `.env`.

## Architecture

```/dev/null/tree.txt#L1-20
src/
├── index.ts                 # Entry point (Bun.serve)
├── config/env.ts            # Zod-validated environment
├── pages/
│   └── privacy.ts           # GET /privacy — renders docs/privacy-policy.md
├── webhooks/
│   ├── router.ts            # GET/POST /webhook handlers
│   ├── verify.ts            # HMAC signature verification
│   └── parser.ts            # Parse Meta webhook events
├── handlers/
│   ├── comment.handler.ts   # Comment → keyword match → DM
│   ├── message.handler.ts   # DM → email collection / keyword match
│   ├── postback.handler.ts  # Button clicks → email flow
│   └── mention.handler.ts   # Story mention → thank you DM
├── services/
│   ├── instagram.service.ts # Instagram Graph API client
│   ├── keyword.service.ts   # Keyword matching engine
│   ├── cooldown.service.ts  # Rate limits & cooldowns
│   ├── lead.service.ts      # Lead CRUD (PostgreSQL)
│   ├── email.service.ts     # Resend email delivery
│   ├── reminder.service.ts  # 10-min email reminder
│   └── db.ts                # Database connection & migrations
└── utils/
    ├── logger.ts            # Pino structured logging
    ├── retry.ts             # Exponential backoff for API calls
    └── templates.ts         # {{username}} template rendering
```

## Docker Compose Services

| Service | Image | Description |
|---------|-------|-------------|
| `app` | Built from `Dockerfile` | The hotdog-bot application |
| `db` | `postgres:16-alpine` | PostgreSQL database with persistent volume |

Data is persisted in a named Docker volume (`pgdata`). The app starts after the `db` service is up.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{"status":"ok"}` |
| `GET` | `/privacy` | Privacy policy page (rendered from `docs/privacy-policy.md`) |
| `GET` | `/webhook` | Meta webhook verification (challenge response) |
| `POST` | `/webhook` | Meta webhook events (DMs, comments, postbacks, mentions) |

## Running Locally

```/dev/null/bash.sh#L1-11
# Development (auto-reload)
bun run dev

# Build
bun run build

# Production
bun start

# Tests
bun test
```

For local webhook testing, use [ngrok](https://ngrok.com) to expose your local server:

```/dev/null/bash.sh#L1-2
ngrok http 3000
# Then set the ngrok URL as your webhook URL in Meta Developer Console
```

## Documentation

- [Configuration](docs/configuration.md) — Environment variables, database, email, logging
- [Keywords](docs/keywords.md) — Rule schema, match types, examples
- [Setup & Testing](docs/setup-and-testing.md) — Deploy, Meta webhook setup, testing, troubleshooting
- [Privacy Policy](docs/privacy-policy.md) — Served at `/privacy`

---

## Disclaimer

This software uses the official Instagram Messaging API. Using it for your own account (personal or business) is permitted by Meta's platform policies and does not require App Review. Using it to manage third-party accounts may require additional Meta approvals.

This is not legal advice. The authors accept no liability for any account suspension, ban, legal claim, or other consequence arising from the use of this software. **Use at your own risk.**
