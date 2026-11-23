const API_BASE = "https://api.groupme.com/v3";
const BOT_NAME = "Acalanes Scam Review";
const INTRO_MESSAGE = "Hi! I'm the Acalanes Data Science Club's scam review bot. I watch for a few common scam patterns to help moderators review suspicious messages. I can't delete messages or decide who should be removed. If you see something suspicious, please flag it to a group admin.";

const accessToken = process.env.GROUPME_ACCESS_TOKEN;
const groupId = process.env.GROUPME_GROUP_ID;
const callbackUrl = process.env.GROUPME_CALLBACK_URL;

if (!accessToken || !groupId || !callbackUrl) {
  console.error("Set GROUPME_ACCESS_TOKEN, GROUPME_GROUP_ID, and GROUPME_CALLBACK_URL locally before running setup.");
  process.exit(1);
}

let parsedCallbackUrl;
try {
  parsedCallbackUrl = new URL(callbackUrl);
} catch {
  console.error("GROUPME_CALLBACK_URL must be a valid HTTPS URL.");
  process.exit(1);
}

if (
  parsedCallbackUrl.protocol !== "https:"
  || parsedCallbackUrl.username
  || parsedCallbackUrl.password
  || parsedCallbackUrl.search
  || parsedCallbackUrl.hash
  || !/^\/api\/groupme-moderation\/[^/]+$/.test(parsedCallbackUrl.pathname)
) {
  console.error("GROUPME_CALLBACK_URL must be HTTPS and use /api/groupme-moderation/<secret> with no query string.");
  process.exit(1);
}

async function groupMeRequest(path, options = {}, includeAccessToken = true) {
  const result = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(includeAccessToken ? { "X-Access-Token": accessToken } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });

  let payload = null;
  try {
    payload = await result.json();
  } catch {
    // The caller only needs the status if GroupMe returns a non-JSON response.
  }

  return { ok: result.ok, status: result.status, payload };
}

function responseValue(payload) {
  return payload?.response ?? payload;
}

try {
  const botsResult = await groupMeRequest("/bots");
  if (!botsResult.ok) {
    console.error(`Could not check existing bots (HTTP ${botsResult.status}); no bot was created.`);
    process.exit(1);
  }

  const botListValue = responseValue(botsResult.payload);
  const bots = Array.isArray(botListValue)
    ? botListValue
    : Array.isArray(botListValue?.bots)
      ? botListValue.bots
      : [];
  const existingBot = bots.find((bot) => (
    String(bot.group_id) === groupId && bot.callback_url === callbackUrl
  ));

  if (existingBot) {
    console.log("A bot is already registered for this group and callback. Setup stopped to avoid duplicate bots or welcome messages.");
    console.log(`Use this bot ID in Vercel if you later enable review alerts: ${existingBot.bot_id}`);
    process.exit(0);
  }

  const createResult = await groupMeRequest("/bots", {
    method: "POST",
    body: JSON.stringify({
      bot: {
        name: BOT_NAME,
        group_id: groupId,
        callback_url: callbackUrl,
        active: true,
      },
    }),
  });

  if (!createResult.ok) {
    console.error(`Could not create the GroupMe bot (HTTP ${createResult.status}).`);
    process.exit(1);
  }

  const createdBot = responseValue(createResult.payload)?.bot ?? responseValue(createResult.payload);
  const botId = createdBot?.bot_id;
  if (!botId) {
    console.error("GroupMe created a response without a bot ID. Check the GroupMe bot list before running setup again.");
    process.exit(1);
  }

  const introResult = await groupMeRequest("/bots/post", {
    method: "POST",
    body: JSON.stringify({ bot_id: botId, text: INTRO_MESSAGE }),
  }, false);

  if (!introResult.ok) {
    console.error(`The bot was created, but its introduction was not posted (HTTP ${introResult.status}). Do not rerun setup; use the bot ID below to retry manually.`);
    console.log(`Bot ID: ${botId}`);
    process.exit(1);
  }

  console.log("Created the GroupMe review bot and posted its introduction to the group.");
  console.log(`Bot ID: ${botId}`);
  console.log("Keep this ID private. Add it to Vercel only if you later enable review alerts.");
} catch (error) {
  console.error(`GroupMe setup failed (${error instanceof Error ? error.name : "unknown error"}). Check the bot list before trying again.`);
  process.exit(1);
}
