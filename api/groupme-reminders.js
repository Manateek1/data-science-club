import { timingSafeEqual } from "node:crypto";

const TIME_ZONE = "America/Los_Angeles";

const REMINDERS = new Map([
  ["Thu 08", {
    id: "thursday-morning",
    text: "Come join Acalanes Data Science Club tomorrow at lunch in Room 105! We'd love to see you there!",
  }],
  ["Fri 07", {
    id: "friday-morning",
    text: "Happy Friday! Acalanes Data Science Club meets today at lunch in Room 105. We'd love to see you there!",
  }],
  ["Fri 12", {
    id: "friday-meeting",
    text: "Reminder: Acalanes Data Science Club meets today at lunch in Room 105. Come join us-we'd love to see you!",
  }],
]);

const REMINDERS_BY_ID = new Map(
  [...REMINDERS.values()].map((reminder) => [reminder.id, reminder]),
);

const TEST_REMINDER = {
  id: "groupme-test",
  text: "Reminder bot test-please ignore",
};

function getLocalDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    weekday: values.weekday,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getLocalHour({ weekday, hour }) {
  return `${weekday} ${String(hour).padStart(2, "0")}`;
}

function isWithinDeliveryWindow(reminderId, localDateTime) {
  const deliveryWindows = {
    "thursday-morning": { weekday: "Thu", start: 8 * 60 + 17, end: 10 * 60 },
    "friday-morning": { weekday: "Fri", start: 7 * 60 + 17, end: 10 * 60 },
    "friday-meeting": { weekday: "Fri", start: 12 * 60 + 50, end: 13 * 60 },
  };
  const window = deliveryWindows[reminderId];
  if (!window || window.weekday !== localDateTime.weekday) return false;

  const localMinute = localDateTime.hour * 60 + localDateTime.minute;
  return localMinute >= window.start && localMinute < window.end;
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

  if (!hasValidCronSecret(
    request.headers.authorization,
    process.env.GROUPME_REMINDER_SECRET,
  )) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  const requestUrl = new URL(request.url ?? "/", "https://groupme-reminders.invalid");
  const hasTestParameter = requestUrl.searchParams.has("test");
  const testMode = requestUrl.searchParams.get("test") === "1";
  const requestedReminderId = requestUrl.searchParams.get("reminder");

  if (hasTestParameter && (!testMode || requestedReminderId)) {
    return response.status(400).json({ error: "Invalid reminder request." });
  }

  const localDateTime = getLocalDateTime(new Date());
  let reminder;
  if (testMode) {
    reminder = TEST_REMINDER;
  } else if (requestedReminderId) {
    reminder = REMINDERS_BY_ID.get(requestedReminderId);
    if (!reminder) {
      return response.status(400).json({ error: "Unknown reminder." });
    }
  } else {
    reminder = REMINDERS.get(getLocalHour(localDateTime));
  }

  if (!reminder) {
    return response.status(204).end();
  }

  if (!testMode && !isWithinDeliveryWindow(reminder.id, localDateTime)) {
    console.log(JSON.stringify({ event: reminder.id, status: "skipped", reason: "outside_delivery_window" }));
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

