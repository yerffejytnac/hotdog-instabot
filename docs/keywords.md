# Configuring Keywords

Keywords are the automation rules that drive Hotdog InstaBot. When a user sends a DM (or comments on a post) containing a matching keyword, the bot responds automatically.

Rules are defined in `keywords.json` at the project root. The file is loaded once at startup — restart the app (or redeploy) after editing.

---

## Rule Schema

Each rule is a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier for the rule (used in logs, lead tracking, and postback payloads) |
| `keyword` | string | ✅ | Primary trigger text |
| `aliases` | string[] | ✅ | Alternative trigger texts (can be empty `[]`) |
| `matchType` | string | ✅ | One of `"exact"`, `"contains"`, or `"word_boundary"` |
| `priority` | number | ✅ | Lower number = higher priority (checked first) |
| `enabled` | boolean | ✅ | Set `false` to disable without removing |
| `cooldownMinutes` | number | ✅ | Minutes before the same user can re-trigger this rule |
| `askEmail` | boolean | ❌ | If `true`, the bot asks for the user's email after they tap the CTA button (default: `false`) |
| `response` | object | ✅ | The initial message sent to the user (see below) |
| `followUp` | object | ❌ | Message sent after the user provides their email (only relevant when `askEmail: true`) |

### Response / FollowUp Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | `"text"` for a plain message, `"button"` for a message with buttons |
| `text` | string | ✅ | Message body — supports `{{username}}` placeholder |
| `buttons` | array | ❌ | Array of button objects (required when `type` is `"button"`, max 3) |

### Button Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | `"web_url"` (opens a link) or `"postback"` (triggers a callback) |
| `title` | string | ✅ | Button label (max 20 characters) |
| `url` | string | ❌ | URL to open (required for `web_url`) |
| `payload` | string | ❌ | Postback payload (required for `postback`; use `"start_email:<rule_id>"` to trigger the email flow) |

---

## Match Types

All matching is **case-insensitive**.

### `exact`

The entire message must match the keyword or alias exactly (after trimming and lowercasing).

```json
{ "keyword": "BOOKING", "matchType": "exact" }
```

| Message | Match? |
|---------|--------|
| "BOOKING" | ✅ |
| "booking" | ✅ |
| "I want a booking" | ❌ |

### `contains`

The keyword can appear anywhere in the message.

```json
{ "keyword": "PRICING", "matchType": "contains" }
```

| Message | Match? |
|---------|--------|
| "PRICING" | ✅ |
| "What's your pricing?" | ✅ |
| "Send me the pricing guide please" | ✅ |

### `word_boundary`

Matches the keyword as a whole word (using `\b` regex boundaries). Prevents false positives from substrings.

```json
{ "keyword": "BOOK", "matchType": "word_boundary" }
```

| Message | Match? |
|---------|--------|
| "I want to book" | ✅ |
| "book a session" | ✅ |
| "FACEBOOK" | ❌ |
| "bookkeeper" | ❌ |

---

## Examples

### Minimal — plain text reply

```json
[
  {
    "id": "hotdog",
    "keyword": "🌭",
    "aliases": [],
    "matchType": "contains",
    "priority": 1,
    "enabled": true,
    "cooldownMinutes": 60,
    "askEmail": false,
    "response": {
      "type": "text",
      "text": "Hey {{username}}! 🌭📸 Thanks for reaching out!"
    }
  }
]
```

### With a button linking to a URL

```json
{
  "id": "portfolio",
  "keyword": "PORTFOLIO",
  "aliases": ["GALLERY", "EXAMPLES", "WORK"],
  "matchType": "contains",
  "priority": 2,
  "enabled": true,
  "cooldownMinutes": 60,
  "askEmail": false,
  "response": {
    "type": "button",
    "text": "Hey {{username}}! 📸 Here's a peek at some of our favourite dog portraits!",
    "buttons": [
      {
        "type": "web_url",
        "title": "View portfolio",
        "url": "https://hotdog.photo/portfolio"
      }
    ]
  }
}
```

### Full email collection flow

When `askEmail` is `true`, the flow is:

1. User triggers keyword → bot sends `response` (with a postback button)
2. User taps button → bot asks "What's your email?"
3. User replies with email → bot stores it, sends `followUp` message + welcome email
4. If user doesn't reply within 10 minutes → bot sends a reminder DM

```json
{
  "id": "booking",
  "keyword": "BOOKING",
  "aliases": ["BOOK", "APPOINTMENT", "SCHEDULE"],
  "matchType": "contains",
  "priority": 1,
  "enabled": true,
  "cooldownMinutes": 60,
  "askEmail": true,
  "response": {
    "type": "button",
    "text": "Hey {{username}}! 🐾 We'd love to photograph your pup! Let me send you our booking info.",
    "buttons": [
      {
        "type": "postback",
        "title": "Book a session",
        "payload": "start_email:booking"
      }
    ]
  },
  "followUp": {
    "type": "button",
    "text": "Here's the link to book your dog portrait session. Check your email too! 📸🐕",
    "buttons": [
      {
        "type": "web_url",
        "title": "Book your session",
        "url": "https://hotdog.photo/book"
      }
    ]
  }
}
```

> **Note:** The postback `payload` must follow the format `start_email:<rule_id>` to trigger the email collection flow.

### Multiple rules together

Rules are checked in `priority` order (lowest number first). The first match wins.

```json
[
  {
    "id": "booking",
    "keyword": "BOOKING",
    "aliases": ["BOOK", "SESSION"],
    "matchType": "contains",
    "priority": 1,
    "enabled": true,
    "cooldownMinutes": 60,
    "askEmail": true,
    "response": { "type": "text", "text": "Let's get you booked in, {{username}}!" }
  },
  {
    "id": "pricing",
    "keyword": "PRICING",
    "aliases": ["PRICE", "COST", "HOW MUCH"],
    "matchType": "contains",
    "priority": 2,
    "enabled": true,
    "cooldownMinutes": 60,
    "askEmail": false,
    "response": { "type": "text", "text": "Our sessions start at $250 — DM us to book!" }
  }
]
```

---

## Tips

- **Emoji keywords work** — `"keyword": "🌭"` with `"matchType": "contains"` will match any message containing the hotdog emoji.
- **Cooldowns are per-user, per-keyword** — a user won't get spammed if they mention the same keyword multiple times.
- **There's also a global rate limit** of 30 DMs per hour per user across all keywords.
- **Disabled rules** (`"enabled": false`) are skipped at load time — they won't match anything.
- **`keywords.json` is baked into the Docker image.** To change rules without rebuilding, you can volume-mount the file in `docker-compose.yml`:
  ```yaml
  volumes:
    - ./keywords.json:/app/keywords.json:ro
  ```
