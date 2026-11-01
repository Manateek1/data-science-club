import assert from "node:assert/strict";
import { after, test } from "node:test";
import handler from "../api/groupme-reminders.js";

const originalSecret = process.env.GROUPME_REMINDER_SECRET;
const originalBotId = process.env.GROUPME_BOT_ID;
const originalFetch = globalThis.fetch;

process.env.GROUPME_REMINDER_SECRET = "test-secret";
process.env.GROUPME_BOT_ID = "test-bot";

after(() => {
  if (originalSecret === undefined) delete process.env.GROUPME_REMINDER_SECRET;
  else process.env.GROUPME_REMINDER_SECRET = originalSecret;
  if (originalBotId === undefined) delete process.env.GROUPME_BOT_ID;
  else process.env.GROUPME_BOT_ID = originalBotId;
  globalThis.fetch = originalFetch;
});

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function invoke(url, { authorization = "Bearer test-secret", method = "GET" } = {}) {
  const response = createResponse();
  await handler({ method, url, headers: { authorization } }, response);
  return response;
}

test("all scheduled reminder IDs send their matching fixed GroupMe messages", async () => {
  const reminders = [
    {
      id: "thursday-evening",
      text: "Come join Acalanes Data Science Club tomorrow at lunch in Room 105! We'd love to see you there!",
    },
    {
      id: "friday-morning",
      text: "Happy Friday! Acalanes Data Science Club meets today at lunch in Room 105. We'd love to see you there!",
    },
    {
      id: "friday-meeting",
      text: "Reminder: Acalanes Data Science Club meets today at lunch in Room 105. Come join us—we'd love to see you!",
    },
  ];

  for (const reminder of reminders) {
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return new Response(null, { status: 201 });
    };

    const response = await invoke(
      "/api/groupme-reminders?reminder=" + reminder.id,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { sent: true, reminder: reminder.id });
    assert.equal(request.url, "https://api.groupme.com/v3/bots/post");
    assert.deepEqual(JSON.parse(request.options.body), {
      bot_id: "test-bot",
      text: reminder.text,
    });
  }
});

test("manual test mode sends only the fixed test message", async () => {
  let postedBody;
  globalThis.fetch = async (_url, options) => {
    postedBody = JSON.parse(options.body);
    return new Response(null, { status: 201 });
  };

  const response = await invoke("/api/groupme-reminders?test=1");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { sent: true, reminder: "groupme-test" });
  assert.deepEqual(postedBody, {
    bot_id: "test-bot",
    text: "Reminder bot test—please ignore",
  });
});

test("invalid auth and reminder IDs do not call GroupMe", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 201 });
  };

  const unauthorized = await invoke("/api/groupme-reminders?test=1", {
    authorization: "Bearer wrong-secret",
  });
  assert.equal(unauthorized.statusCode, 401);

  const unknownReminder = await invoke("/api/groupme-reminders?reminder=unknown");
  assert.equal(unknownReminder.statusCode, 400);
  assert.equal(fetchCalled, false);
});
