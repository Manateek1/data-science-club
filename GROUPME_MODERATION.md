# GroupMe scam review monitor

## API capability and limits

The official GroupMe v3 bot callback sends an HTTP POST for each new group message. A bot can post messages with its bot ID. The public API reference documents reading and creating messages, posting from a bot, and removing group members; it does not document an endpoint to delete a message. It also does not document a more powerful “admin token” that can delete other members’ messages. This means automatic deletion is not available through the supported public API.

This monitor therefore flags a small set of high-risk patterns. It starts in `dry-run` mode and never deletes messages. In optional `review` mode it posts a generic warning for a moderator to review. The rules require a direct request for credentials, or a scam-style lure combined with an untrusted link. A normal link alone is not enough.

## What it does

- Receives GroupMe callbacks at `/api/groupme-moderation/<secret>`.
- Ignores system and bot messages, messages from allowlisted user IDs, and messages outside the configured group.
- Supports allowlisted user IDs and trusted URL domains.
- Logs only flagged message IDs, rule codes, mode, and alert result. It never logs message text, sender names, or URLs.
- Defaults to `dry-run`, which logs a match without posting anything to the chat.
- In `review` mode, posts one generic warning through the bot. It still cannot remove or edit the original message.

The GroupMe callback has no documented request signature. The random secret in the URL path is the webhook's bearer credential. Keep it private, use a different value from any GroupMe token, and rotate it if it is exposed. The function processes message text in memory and does not save message bodies.

## Vercel settings

Set these variables in the club's Vercel project:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROUPME_WEBHOOK_SECRET` | Yes | At least 32 random bytes, encoded as hex; must match the secret path segment. |
| `GROUPME_GROUP_ID` | Yes | The single group allowed to use this endpoint. |
| `GROUPME_MODERATION_MODE` | No | `dry-run` (default) or `review`. |
| `GROUPME_MODERATION_ALLOWLIST_USER_IDS` | No | Comma-separated GroupMe sender IDs that should never be flagged. |
| `GROUPME_MODERATION_ALLOWLIST_DOMAINS` | No | Comma-separated trusted domains; subdomains are also trusted. Do not include a URL path. |
| `GROUPME_MODERATION_BOT_ID` | Only for `review` | The dedicated moderation bot ID used only to post generic review warnings. Keep it separate from the reminder bot's `GROUPME_BOT_ID`. Treat it as a secret. |

Do not place a GroupMe OAuth access token in Vercel for this monitor. The function does not need one. Use Vercel's encrypted environment settings, keep the mode at `dry-run`, and redeploy after changing environment variables.

## Setup

1. Deploy the project with `GROUPME_MODERATION_MODE=dry-run`, the target group ID, and a fresh webhook secret. Build the callback URL from the deployment's HTTPS domain and the exact secret path, for example `https://<your-domain>/api/groupme-moderation/<your-secret>`. Keep the URL private.
2. Set `GROUPME_ACCESS_TOKEN`, `GROUPME_GROUP_ID`, and `GROUPME_CALLBACK_URL` in your local shell, then run `node scripts/create-groupme-moderation-bot.mjs` from the repository root. The script creates a dedicated bot with that callback, posts its introduction in the group, and prints the bot ID. It uses the access token only for the bot-list and bot-creation requests; the token is not saved or printed. Do not commit it or add it to Vercel. The script checks for an existing bot with the same callback URL and stops without creating a duplicate or posting another introduction.
3. Add the printed bot ID to Vercel as `GROUPME_MODERATION_BOT_ID` only if you later enable `review` mode. Keep the existing reminder bot's `GROUPME_BOT_ID` unchanged. Post a few harmless sample messages in the group and inspect Vercel function logs. Unflagged messages and allowlisted users produce no audit event. Flagged events record only their message ID and reason codes.
4. Add trusted member IDs and domains to the allowlists. A trusted domain suppresses URL-based rules for that domain; a direct request for passwords, codes, or wallet keys is still flagged. Leave the monitor in dry-run until the club's moderators are comfortable with the matches.
5. If the club wants visible review warnings, set `GROUPME_MODERATION_MODE=review` in Vercel and redeploy. That mode posts a generic warning; it does not delete anything.

If GroupMe does not deliver callbacks, verify that the bot is active, is registered in the correct group, and has the exact HTTPS callback URL. Rotate the URL secret if it was shared outside the moderators.

## Limits

- The rules are intentionally narrow and can miss scams. They are not a content classifier or link reputation service.
- Links encoded inside images and non-URL attachments are not inspected, and there is no OCR. URL fields in message text and attachments are checked against the trusted-domain list.
- The callback covers all messages in the configured group, so the bot receives message content even though this code does not retain it.
- Review warnings are ordinary GroupMe posts and may be repeated if GroupMe redelivers the same callback; there is no external database or durable deduplication store.
- Admins must use GroupMe's app to review and remove messages manually. The public API docs provide no message-delete operation.

## Official references

- [GroupMe v3 API reference](https://dev.groupme.com/docs/v3)
- [GroupMe bots tutorial](https://dev.groupme.com/tutorials/bots)
- [GroupMe API license agreement](https://dev.groupme.com/terms)
