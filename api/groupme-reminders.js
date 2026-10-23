import { timingSafeEqual } from "node:crypto";

const TIME_ZONE = "America/Los_Angeles";

const REMINDERS = new Map([
  ["Thu 18", {
    id: "thursday-evening",
    text: "You're invited! Acalanes Data Science Club meets tomorrow at lunch in Room 105. Come join us—we'd love to see you there!",
  }],
  ["Fri 08", {
    id: "friday-morning",
    text: "Happy Friday! Join Acalanes Data Science Club at lunch today in Room 105. Bring a friend—we'd love to have you!",
  }],
  ["Fri 12", {
    id: "friday-meeting",
    text: "It's club day! Acalanes Data Science Club meets at lunch in Room 105—come join us!",
  }],
]);

function getLocalHour(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.weekday} ${values.hour}`;
}

function hasValidCronSecret(authorization, secret) {
  if (typeof authorization !== "string" || !secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!hasValidCronSecret(request.headers.authorization, process.env.CRON_SECRET)) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  const reminder = REMINDERS.get(getLocalHour(new Date()));
  if (!reminder) {
    return response.status(204).end();
  }

  const botId = process.env.GROUPME_BOT_ID;
  if (!botId) {
    console.error(JSON.stringify({ event: reminder.id, error: "GROUPME_BOT_ID is not configured." }));
    return response.status(503).json({ error: "Reminder sender is not configured." });
  }

  try {
    const groupMeResponse = await fetch("https://api.groupme.com/v3/bots/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_id: botId, text: reminder.text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!groupMeResponse.ok) {
      console.error(JSON.stringify({ event: reminder.id, groupMeStatus: groupMeResponse.status }));
      return response.status(502).json({ error: "GroupMe did not accept the reminder." });
    }

    console.log(JSON.stringify({ event: reminder.id, status: "sent" }));
    return response.status(200).json({ sent: true, reminder: reminder.id });
  } catch (error) {
    console.error(JSON.stringify({
      event: reminder.id,
      error: error instanceof Error ? error.name : "UnknownError",
    }));
    return response.status(502).json({ error: "Could not reach GroupMe." });
  }
}
