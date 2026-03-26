# Hotdog InstaBot 🌭📸

**Open-source ManyChat alternative. Self-hosted Instagram DM automation for dog portrait photography.**

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
User comments "BOOKING" on your post
        │
        ▼
InstaBot matches keyword → sends DM with CTA button
        │
        ▼
User clicks button → "What's your email?"
        │
        ▼
User sends email → Booking info delivered via DM + email
```

## Quick Start

### 1. Clone and install

```/dev/null/bash.sh#L1-3
git clone https://github.com/your-org/hotdog-instabot.git
cd hotdog-instabot
bun install
```

### 2. Configure environment

```/dev/null/bash.sh#L1-2
cp .env.example .env
# Edit .env with your Meta API credentials, Postgres password, etc.
```

### 3. Set up your keywords

Edit `keywords.json` to define your automation rules. Three rules are included out of the box:

| Keyword | Aliases | Description |
|---------|---------|-------------|
| `BOOKING` | BOOK, APPOINTMENT, SCHEDULE, SESSION | Sends booking link + collects email |
| `PRICING` | PRICE, COST, RATES, HOW MUCH, PACKAGES | Sends pricing guide + collects email |
| `PORTFOLIO` | GALLERY, EXAMPLES, WORK, PHOTOS, SAMPLES | Links to portfolio (no email required) |

### 4. Deploy to Dokploy

This project ships with a `docker-compose.yml` ready for [Dokploy's Docker Compose deployment mode](https://docs.dokploy.com/docs/core/docker-compose).

#### Option A: Deploy via Dokploy UI

1. In the Dokploy dashboard, create a new **Compose** project
2. Point it to your Git repository (or paste the `docker-compose.yml` contents)
3. Add your environment variables in the Dokploy **Environment** tab (see table below)
4. Set `POSTGRES_PASSWORD` to a strong, unique value
5. Deploy — Dokploy builds the image, starts Postgres, and wires everything up
6. Configure your domain (e.g., `instabot.hotdog.photo`) in Dokploy's proxy settings — it handles TLS automatically

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
2. Set webhook URL to `https://instabot.hotdog.photo/webhook`
3. Subscribe to: `comments`, `messages`, `messaging_postbacks`

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
| `ADMIN_API_KEY` | Yes | API key for admin endpoints |
| `PORT` | No | Server port (default: 3000) |
| `RESEND_API_KEY` | No | Resend API key (enables email features) |
| `EMAIL_FROM` | No | Sender address (default: `Hotdog Photo <hello@hotdog.photo>`) |
| `WELCOME_EMAIL_TEMPLATE` | No | Welcome email template filename (default: `welcome-generic.html`) |

### Keyword Match Types

| Type | Behavior | Example |
|------|----------|---------|
| `exact` | Full text must match | "BOOKING" matches "BOOKING" only |
| `contains` | Keyword anywhere in text | "BOOKING" matches "I want a BOOKING please" |
| `word_boundary` | Whole word match | "BOOK" matches "I want to BOOK" but not "FACEBOOK" |

All matching is case-insensitive.

### Email Templates

A welcome email template is included in `email-templates/`:

- `welcome-generic.html` — Hotdog-branded welcome email (default)

The template uses `{{1.record.full_name}}` as the name placeholder. To create your own, add an HTML file to `email-templates/` and set `WELCOME_EMAIL_TEMPLATE` in your `.env`.

## Architecture

```/dev/null/tree.txt#L1-18
src/
├── index.ts                 # Entry point
├── config/env.ts            # Zod-validated environment
├── webhooks/
│   ├── router.ts            # GET/POST /webhook
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
| `app` | Built from `Dockerfile` | The InstaBot application |
| `db` | `postgres:16-alpine` | PostgreSQL database with persistent volume |

The app waits for the database health check to pass before starting. Data is persisted in a named Docker volume (`pgdata`). Containers are named `instabot` and `instabot-db`.

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

---

## License

MIT — use it, modify it, sell it. See [LICENSE](LICENSE) for details.

---

## Disclaimer

To the best of our understanding, using this tool with the official Instagram Messaging API for your own account (personal or business) is permitted by Meta's platform policies and does not require App Review. However, using it to manage third-party accounts or offer it as a service to clients may require additional Meta approvals.

This is not legal advice. If you intend to use this tool commercially or on behalf of clients, consult a qualified legal professional to ensure compliance with Meta's Platform Terms, Instagram's policies, and applicable laws.

The authors and contributors of this project accept no liability for any account suspension, ban, legal claim, or other consequence arising from the use of this software. **Use at your own risk.**
