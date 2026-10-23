# GroupMe meeting reminders

The Vercel project can post three reminders to the club's GroupMe group:

- Thursday at 6:00 PM: a friendly invitation for the next day's lunch meeting.
- Friday at 8:00 AM: a same-day reminder for the lunch meeting.
- Friday at 12:50 PM: a final lunch-time invitation to meet in Room 105.

All times use `America/Los_Angeles`. Vercel Cron schedules use UTC, so
`vercel.json` includes both Pacific daylight-time and standard-time UTC slots
for each reminder. The function matches the current Pacific weekday and hour.
On Vercel Pro, cron runs at the configured minute (including 12:50 PM). On
the current Hobby plan, Vercel has hour-level timing precision, so the
function accepts the matching hour to avoid skipping a reminder when the cron
invocation shifts within that hour. This avoids changing the schedule when
daylight saving time changes.

## Required Vercel settings

Add these as **Production** environment variables in the existing
`acalanes-data-science-club` Vercel project:

- `GROUPME_BOT_ID`: the bot ID returned when the bot is created. Treat it as a
  secret because it can post to the group.
- `CRON_SECRET`: a separate, randomly generated secret with at least 32 bytes
  of entropy. Vercel sends it to the function as a Bearer authorization value
  for Cron requests.

Create the bot from GroupMe's [Bots page](https://dev.groupme.com/bots), choose
the club's GroupMe group, and copy the returned bot ID into Vercel. The
GroupMe API access token is not needed to send messages with an existing bot.
Keep both values in Vercel's environment settings; do not put them in this
repository or send them in chat.

## Timing and operation

The current Vercel team uses Hobby, whose cron timing has hour-level precision
(up to 59 minutes of variation). The reminders will post during the matching
Pacific hour, but may not arrive exactly at 6:00 PM, 8:00 AM, or 12:50 PM.
Per-minute timing requires Vercel Pro. Cron schedules run only on production
deployments, so a preview deployment will not post messages. If a production
invocation is missed or GroupMe rejects a post, check the Vercel function
logs; this small implementation does not keep a queue or retry missed
reminders.

The endpoint also requires Vercel's Cron authorization header, accepts only
GET requests, sends the bot ID in the HTTPS request body, and never logs that
ID or the authorization value.
