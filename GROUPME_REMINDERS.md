# GroupMe meeting reminders

The Vercel project can post three reminders to the club's GroupMe group:

- Thursday at 6:00 PM: the meeting is tomorrow.
- Friday at 8:00 AM: the meeting is today at 12:50 PM.
- Friday at 12:50 PM: the meeting is starting in Room 105.

All times use `America/Los_Angeles`. Vercel Cron schedules use UTC, so
`vercel.json` includes both Pacific daylight-time and standard-time UTC slots
for each reminder. The function sends only when the current Pacific weekday
and minute match one of the three reminders; the alternate UTC slot is a
no-op. This avoids changing the schedule when daylight saving time changes.

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

Vercel's Hobby Cron timing can vary by up to 59 minutes. These reminders need
minute-level scheduling, which requires Vercel Pro. Cron schedules run only
on production deployments, so a preview deployment will not post messages.
The function checks the actual Pacific time and skips any invocation outside
the exact scheduled minute. If a production invocation is missed or GroupMe
rejects a post, check the Vercel function logs; this small implementation does
not keep a queue or retry missed reminders.

The endpoint also requires Vercel's Cron authorization header, accepts only
GET requests, sends the bot ID in the HTTPS request body, and never logs that
ID or the authorization value.
