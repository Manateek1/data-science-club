# GroupMe meeting reminders

The club receives three reminders through a GitHub Actions schedule:

- Thursday at 5:07 PM: an invitation for Friday's lunch meeting.
- Friday at 7:17 AM: a same-day reminder for the lunch meeting.
- Friday at 11:23 AM: a final reminder to meet at lunch in Room 105.

All times use America/Los_Angeles, including daylight saving time. GitHub
Actions calls the production Vercel function with the reminder ID for that
schedule, so a delayed workflow still sends the correct reminder instead of
silently skipping it based on the current hour. The schedule uses minutes away
from the top of the hour to reduce GitHub Actions queue delays.

## Required Vercel settings

Add these as **Production** environment variables in the existing
`acalanes-data-science-club` Vercel project:

- GROUPME_BOT_ID: the bot ID returned when the bot is created. Treat it as a
  secret because it can post to the group.
- GROUPME_REMINDER_SECRET: a randomly generated secret with at least 32 bytes
  of entropy. Store the same value as a Production environment variable in
  Vercel and as a repository Actions secret in GitHub.

Create the bot from GroupMe's [Bots page](https://dev.groupme.com/bots), choose
the club's GroupMe group, and copy the returned bot ID into Vercel. The
GroupMe API access token is not needed to send messages with an existing bot.
Keep both values in Vercel's environment settings; do not put them in this
repository or send them in chat.

## Timing and operation

The workflow is in .github/workflows/groupme-reminders.yml and runs on the
repository's default branch. Its manual Run workflow option can send one fixed
test message to verify GroupMe delivery. Scheduled workflow failures are
visible in the GitHub Actions run logs. The reminder function remains hosted
by Vercel.

The endpoint accepts only GET requests, requires the shared Bearer secret,
sends the bot ID in the HTTPS request body, and never logs either secret.
