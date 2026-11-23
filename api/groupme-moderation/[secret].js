import { timingSafeEqual } from "node:crypto";

const MAX_TEXT_LENGTH = 5_000;
const MAX_ATTACHMENTS = 20;
const REVIEW_ALERT = "Possible scam message detected. Please pause before opening links or sharing passwords, one-time codes, or wallet recovery phrases. A group admin should review the recent message.";

const DIRECT_CREDENTIAL_REQUEST = /\b(?:send|share|provide|enter|submit|message|dm)\b.{0,50}\b(?:your\s+|the\s+)?(?:password|passcode|verification code|one[- ]time code|otp|seed phrase|recovery phrase|private key)\b/i;
const CRYPTO_WALLET_LURE = /\b(?:connect|verify|unlock|restore|sync)\b.{0,45}\b(?:wallet|crypto account|seed phrase|private key)\b/i;
const URGENT_ACCOUNT_LURE = /\b(?:account|profile|access)\b.{0,35}\b(?:suspended|locked|compromised|restricted|disabled)\b/i;
const ACCOUNT_VERIFICATION = /\b(?:verify|confirm|restore|unlock|secure)\b.{0,45}\b(?:account|profile|access)\b/i;
const PRIZE_OR_PAYMENT_LURE = /\b(?:claim|redeem|collect)\b.{0,45}\b(?:free\s+)?(?:gift card|airdrop|prize|reward|bitcoin|crypto)\b/i;
const PRESSURE_OR_PAYMENT = /\b(?:urgent|immediately|expires? today|limited time|act now|dm me|direct message|processing fee|deposit)\b/i;
const NEGATED_DIRECTIVE = /(?:\bdo not|\bdon't|\bnever|\bavoid|\bmust not)(?:\s+\w+)?\s*$/i;

function stringValue(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function hasValidWebhookSecret(receivedSecret, expectedSecret) {
  if (typeof receivedSecret !== "string" || typeof expectedSecret !== "string") return false;
  if (Buffer.byteLength(expectedSecret, "utf8") < 32) return false;

  const received = Buffer.from(receivedSecret, "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseList(value) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeAllowlistedDomains(value) {
  const domains = new Set();
  for (const item of parseList(value)) {
    try {
      const url = new URL(`https://${item}`);
      if (url.pathname === "/" && !url.search && !url.hash && !url.port) {
        domains.add(url.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed entries instead of treating them as trusted.
    }
  }
  return domains;
}

function isAllowlistedDomain(hostname, allowlistedDomains) {
  return [...allowlistedDomains].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function getMessageUrls(message) {
  const textUrls = typeof message.text === "string"
    ? message.text.match(/https?:\/\/[^\s<>"']+/gi) ?? []
    : [];
  const attachmentUrls = Array.isArray(message.attachments)
    ? message.attachments.map((attachment) => stringValue(attachment?.url)).filter(Boolean)
    : [];

  return [...new Set([...textUrls, ...attachmentUrls])]
    .map((value) => value.replace(/[),.!?;:]+$/, ""))
    .map((value) => {
      try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol)
          ? { hostname: url.hostname.toLowerCase() }
          : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function hasNonNegatedDirective(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return false;
  const before = text.slice(Math.max(0, match.index - 30), match.index);
  return !NEGATED_DIRECTIVE.test(before);
}

function classifyMessage(message, allowlistedDomains) {
  const text = (typeof message.text === "string" ? message.text : "")
    .normalize("NFKC")
    .slice(0, MAX_TEXT_LENGTH);
  const untrustedUrls = getMessageUrls(message)
    .filter(({ hostname }) => !isAllowlistedDomain(hostname, allowlistedDomains));
  const hasUntrustedLink = untrustedUrls.length > 0;
  const reasons = [];

  if (hasNonNegatedDirective(text, DIRECT_CREDENTIAL_REQUEST)) {
    reasons.push("credential_request");
  }
  if (hasUntrustedLink && CRYPTO_WALLET_LURE.test(text)) {
    reasons.push("crypto_wallet_lure_with_link");
  }
  if (hasUntrustedLink && URGENT_ACCOUNT_LURE.test(text) && ACCOUNT_VERIFICATION.test(text)) {
    reasons.push("account_threat_and_verification_link");
  }
  if (hasUntrustedLink && PRIZE_OR_PAYMENT_LURE.test(text) && PRESSURE_OR_PAYMENT.test(text)) {
    reasons.push("pressured_prize_or_payment_link");
  }

  return reasons;
}

function isValidMessage(message) {
  return message !== null
    && typeof message === "object"
    && Boolean(stringValue(message.id))
    && Boolean(stringValue(message.group_id))
    && (!message.text || typeof message.text === "string")
    && (!message.attachments || Array.isArray(message.attachments));
}

async function postReviewAlert(botId) {
  try {
    const result = await fetch("https://api.groupme.com/v3/bots/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_id: botId, text: REVIEW_ALERT }),
      signal: AbortSignal.timeout(8_000),
    });
    return result.ok ? "posted" : "rejected";
  } catch (error) {
    return error instanceof Error ? `error:${error.name}` : "error:unknown";
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const secret = request.query?.secret;
  if (!hasValidWebhookSecret(secret, process.env.GROUPME_WEBHOOK_SECRET)) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  const groupId = process.env.GROUPME_GROUP_ID;
  if (!groupId) {
    return response.status(503).json({ error: "Moderation monitor is not configured." });
  }

  const mode = process.env.GROUPME_MODERATION_MODE || "dry-run";
  if (!["dry-run", "review"].includes(mode)) {
    return response.status(503).json({ error: "Moderation mode is invalid." });
  }

  if (mode === "review" && !process.env.GROUPME_BOT_ID) {
    return response.status(503).json({ error: "Review alerts are not configured." });
  }

  let message = request.body;
  if (typeof message === "string") {
    try {
      message = JSON.parse(message);
    } catch {
      return response.status(400).json({ error: "Invalid JSON payload." });
    }
  }

  if (!isValidMessage(message) || (message.text?.length ?? 0) > MAX_TEXT_LENGTH) {
    return response.status(400).json({ error: "Invalid GroupMe message payload." });
  }
  if ((message.attachments?.length ?? 0) > MAX_ATTACHMENTS) {
    return response.status(400).json({ error: "Too many attachments." });
  }
  if (stringValue(message.group_id) !== groupId) {
    return response.status(403).json({ error: "Unexpected group." });
  }

  if (message.system === true || (message.sender_type && message.sender_type !== "user")) {
    return response.status(200).json({ ok: true, ignored: true });
  }

  const senderId = stringValue(message.sender_id) || stringValue(message.user_id);
  if (parseList(process.env.GROUPME_MODERATION_ALLOWLIST_USER_IDS).has(senderId.toLowerCase())) {
    return response.status(200).json({ ok: true, allowlisted: true });
  }

  const reasons = classifyMessage(
    message,
    normalizeAllowlistedDomains(process.env.GROUPME_MODERATION_ALLOWLIST_DOMAINS),
  );
  if (reasons.length === 0) {
    return response.status(200).json({ ok: true, flagged: false });
  }

  let alertStatus = "dry-run";
  if (mode === "review") {
    alertStatus = await postReviewAlert(process.env.GROUPME_BOT_ID);
  }

  console.info(JSON.stringify({
    event: "groupme_moderation_flag",
    mode,
    messageId: stringValue(message.id),
    reasons,
    alertStatus,
  }));

  return response.status(200).json({
    ok: true,
    flagged: true,
    mode,
    alertStatus,
  });
}
