const OUTREACH = {
  timezone: 'America/Los_Angeles',
  prospectsSheet: 'Prospects',
  suppressionsSheet: 'Suppressions',
  settingsSheet: 'Settings',
  batchFunction: 'createDraftBatch',
  hours: [9, 11, 13, 15, 17],
  defaultBatchSize: 4,
  defaultDailyLimit: 20,
  packetUrl: 'https://ahsdata.com/acalanes-data-fest-sponsorship.pdf',
  sponsorPageUrl: 'https://ahsdata.com/sponsor',
  senderAddress: 'leadership@ahsdata.com',
  senderName: 'Data Science Leadership',
  screenshotSuppressionNames: [
    'Featherless.ai',
    'Crackd',
    'GetCrackd',
    'Knowi',
    'Lovable',
    'DAVTEQ',
  ],
};

const PROSPECT_HEADERS = [
  'Organization',
  'Recipient email',
  'Contact name',
  'Personalization note',
  'Contact eligibility',
  'Eligibility evidence',
  'Status',
  'Draft ID',
  'Draft created at',
  'Sent at',
  'Notes',
  'Consent status',
  'Consent evidence',
];

const SUPPRESSION_HEADERS = [
  'Organization',
  'Recipient email',
  'Domain',
  'Source',
  'Date contacted',
];

const SETTINGS_DEFAULTS = [
  ['Sender address', OUTREACH.senderAddress],
  ['Display name', OUTREACH.senderName],
  ['CC address', 'yeedoreal@gmail.com'],
  ['Sponsor page URL', OUTREACH.sponsorPageUrl],
  ['Packet PDF URL', OUTREACH.packetUrl],
  ['Time zone', OUTREACH.timezone],
  ['Drafts per batch', OUTREACH.defaultBatchSize],
  ['Daily draft limit', OUTREACH.defaultDailyLimit],
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sponsor outreach')
    .addItem('Prepare one draft batch', 'createDraftBatch')
    .addItem('Import prior Data Fest recipients', 'importRecentSentHistory')
    .addItem('Install five daily draft reminders', 'installDraftTriggers')
    .addItem('Remove draft schedule', 'removeDraftTriggers')
    .addToUi();
}

function setupOutreachSheets() {
  const spreadsheet = getOutreachSpreadsheet_();
  const firstSheet = spreadsheet.getSheets()[0];
  if (firstSheet && firstSheet.getName() === 'Sheet1') {
    firstSheet.setName(OUTREACH.prospectsSheet);
  }

  const prospects = getOrCreateSheet_(spreadsheet, OUTREACH.prospectsSheet);
  const suppressions = getOrCreateSheet_(spreadsheet, OUTREACH.suppressionsSheet);
  const settings = getOrCreateSheet_(spreadsheet, OUTREACH.settingsSheet);

  ensureHeaders_(prospects, PROSPECT_HEADERS);
  ensureHeaders_(suppressions, SUPPRESSION_HEADERS);
  ensureHeaders_(settings, ['Setting', 'Value']);
  seedSettings_(settings);
  seedScreenshotSuppressions_(suppressions);

  prospects.setFrozenRows(1);
  suppressions.setFrozenRows(1);
  settings.setFrozenRows(1);
  prospects.setColumnWidths(1, PROSPECT_HEADERS.length, 170);
  prospects.setColumnWidth(2, 240);
  prospects.setColumnWidth(4, 300);
  prospects.setColumnWidth(6, 260);
  suppressions.setColumnWidths(1, SUPPRESSION_HEADERS.length, 200);
  settings.setColumnWidths(1, 2, 230);
  SpreadsheetApp.flush();
}

function importRecentSentHistory() {
  const spreadsheet = getOutreachSpreadsheet_();
  const suppressions = getOrCreateSheet_(spreadsheet, OUTREACH.suppressionsSheet);
  ensureHeaders_(suppressions, SUPPRESSION_HEADERS);

  const knownEmails = new Set(readRows_(suppressions, SUPPRESSION_HEADERS).map(row => normalizeEmail_(row['Recipient email'])).filter(Boolean));
  const senderAddresses = new Set([
    String(Session.getActiveUser().getEmail() || '').toLowerCase(),
    String(Session.getEffectiveUser().getEmail() || '').toLowerCase(),
    ...GmailApp.getAliases().map(value => value.toLowerCase()),
  ].filter(Boolean));
  const threads = GmailApp.search('in:sent after:2026/10/01 "Acalanes Data Fest"', 0, 500);
  const additions = [];

  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      if (!isFromOurAccount_(message.getFrom(), senderAddresses)) continue;
      const date = message.getDate();
      const organization = subjectOrganization_(message.getSubject());
      const recipients = [...splitAddresses_(message.getTo()), ...splitAddresses_(message.getCc())];
      for (const email of recipients) {
        const normalized = normalizeEmail_(email);
        if (!normalized || senderAddresses.has(normalized) || knownEmails.has(normalized)) continue;
        knownEmails.add(normalized);
        additions.push([
          organization,
          normalized,
          domainFromEmail_(normalized),
          'Gmail sent history',
          date,
        ]);
      }
    }
  }

  if (additions.length) {
    suppressions.getRange(suppressions.getLastRow() + 1, 1, additions.length, SUPPRESSION_HEADERS.length).setValues(additions);
  }
  SpreadsheetApp.getUi().alert(`Added ${additions.length} unique prior recipient${additions.length === 1 ? '' : 's'} to Suppressions.`);
}

function createDraftBatch() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    createDraftBatchLocked_();
  } finally {
    lock.releaseLock();
  }
}

function createDraftBatchLocked_() {
  const spreadsheet = getOutreachSpreadsheet_();
  const settings = readSettings_(getOrCreateSheet_(spreadsheet, OUTREACH.settingsSheet));
  const sender = normalizeEmail_(settings['Sender address'] || OUTREACH.senderAddress);
  const displayName = String(settings['Display name'] || OUTREACH.senderName).trim();
  const cc = normalizeEmail_(settings['CC address']);
  const timezone = String(settings['Time zone'] || OUTREACH.timezone).trim();
  const dailyLimit = positiveInteger_(settings['Daily draft limit'], OUTREACH.defaultDailyLimit);
  const batchSize = positiveInteger_(settings['Drafts per batch'], OUTREACH.defaultBatchSize);
  const sponsorPageUrl = String(settings['Sponsor page URL'] || OUTREACH.sponsorPageUrl).trim();
  const packetUrl = String(settings['Packet PDF URL'] || OUTREACH.packetUrl).trim();

  if (!cc) throw new Error('Enter the requested CC address in Settings before creating drafts.');
  if (!GmailApp.getAliases().map(value => value.toLowerCase()).includes(sender)) {
    throw new Error(`Add and verify ${sender} in Gmail > Settings > Accounts and Import > Send mail as before creating drafts.`);
  }

  const properties = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  const dailyKey = `draft_count_${day}`;
  let dailyCount = Number(properties.getProperty(dailyKey) || 0);
  const remaining = Math.max(0, dailyLimit - dailyCount);
  if (!remaining) return;

  const prospects = getOrCreateSheet_(spreadsheet, OUTREACH.prospectsSheet);
  const suppressions = getOrCreateSheet_(spreadsheet, OUTREACH.suppressionsSheet);
  ensureHeaders_(prospects, PROSPECT_HEADERS);
  ensureHeaders_(suppressions, SUPPRESSION_HEADERS);

  const prospectRows = readRows_(prospects, PROSPECT_HEADERS);
  const suppressionRows = readRows_(suppressions, SUPPRESSION_HEADERS);
  const suppressedEmails = new Set();
  const suppressedDomains = new Set();
  const suppressedOrganizations = new Set(OUTREACH.screenshotSuppressionNames.map(normalizeOrganization_));
  for (const row of suppressionRows) {
    const email = normalizeEmail_(row['Recipient email']);
    const domain = normalizeDomain_(row.Domain) || domainFromEmail_(email);
    const organization = normalizeOrganization_(row.Organization);
    if (email) suppressedEmails.add(email);
    if (domain && !isPersonalMailboxDomain_(domain)) suppressedDomains.add(domain);
    if (organization) suppressedOrganizations.add(organization);
  }

  const touchedEmails = new Set(suppressedEmails);
  const touchedDomains = new Set(suppressedDomains);
  const touchedOrganizations = new Set(suppressedOrganizations);
  for (const row of prospectRows) {
    const status = String(row.Status || '').trim().toUpperCase();
    if (!['DRAFTED', 'SENT', 'DO_NOT_CONTACT', 'SUPPRESSED'].includes(status)) continue;
    const email = normalizeEmail_(row['Recipient email']);
    if (email) touchedEmails.add(email);
    const domain = domainFromEmail_(email);
    const companyDomain = domain && !isPersonalMailboxDomain_(domain) ? domain : '';
    if (companyDomain) touchedDomains.add(companyDomain);
    const organization = normalizeOrganization_(row.Organization);
    if (organization) touchedOrganizations.add(organization);
  }

  const candidates = [];
  for (const row of prospectRows) {
    const status = String(row.Status || 'NEW').trim().toUpperCase();
    if (status !== 'NEW') continue;
    if (String(row['Contact eligibility'] || '').trim().toUpperCase() !== 'CONFIRMED') continue;
    if (String(row['Consent status'] || '').trim().toUpperCase() !== 'OPTED_IN') continue;
    if (!String(row['Eligibility evidence'] || '').trim()) continue;
    const consentEvidence = String(row['Consent evidence'] || '').trim();
    if (!/\b20\d{2}-\d{2}-\d{2}\b/.test(consentEvidence)) continue;
    const organization = String(row.Organization || '').trim();
    const email = normalizeEmail_(row['Recipient email']);
    const companyKey = normalizeOrganization_(organization);
    const domain = domainFromEmail_(email);
    const companyDomain = domain && !isPersonalMailboxDomain_(domain) ? domain : '';
    if (!organization || !email || !companyKey) continue;

    const blockedByOrganization = [...touchedOrganizations].some(key => organizationMatches_(companyKey, key));
    if (touchedEmails.has(email) || (companyDomain && touchedDomains.has(companyDomain)) || blockedByOrganization) {
      row.Status = 'SUPPRESSED';
      row.Notes = appendNote_(row.Notes, 'Skipped: recipient or organization already appears in Suppressions or the outreach tracker.');
      continue;
    }

    touchedEmails.add(email);
    if (companyDomain) touchedDomains.add(companyDomain);
    touchedOrganizations.add(companyKey);
    candidates.push(row);
  }

  const selected = candidates.slice(0, Math.min(batchSize, remaining));
  if (!selected.length) {
    writeRows_(prospects, PROSPECT_HEADERS, prospectRows);
    return;
  }

  const packetResponse = UrlFetchApp.fetch(packetUrl, { muteHttpExceptions: true, followRedirects: true });
  if (packetResponse.getResponseCode() !== 200 || !/^application\/pdf/i.test(packetResponse.getHeaders()['Content-Type'] || '')) {
    throw new Error('The sponsorship packet did not load as a PDF. Check the Packet PDF URL before trying again.');
  }
  const packet = packetResponse.getBlob().setName('Acalanes-Data-Fest-Sponsorship.pdf');

  for (const row of selected) {
    const draft = GmailApp.createDraft(
      normalizeEmail_(row['Recipient email']),
      'Acalanes Data Fest 2026 sponsorship information',
      buildEmailBody_(row, sponsorPageUrl),
      {
        from: sender,
        name: displayName,
        replyTo: sender,
        cc,
        attachments: [packet],
      },
    );
    row.Status = 'DRAFTED';
    row['Draft ID'] = draft.getId();
    row['Draft created at'] = new Date();
    dailyCount += 1;
    properties.setProperty(dailyKey, String(dailyCount));
    writeRows_(prospects, PROSPECT_HEADERS, prospectRows);
  }
}

function installDraftTriggers() {
  removeDraftTriggers();
  const timezone = String(readSettings_(getOrCreateSheet_(getOutreachSpreadsheet_(), OUTREACH.settingsSheet))['Time zone'] || OUTREACH.timezone).trim();
  for (const hour of OUTREACH.hours) {
    ScriptApp.newTrigger(OUTREACH.batchFunction)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .inTimezone(timezone)
      .create();
  }
  SpreadsheetApp.getUi().alert('Draft creation is scheduled for five times per day. The script creates drafts only; it never sends them.');
}

function removeDraftTriggers() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === OUTREACH.batchFunction) ScriptApp.deleteTrigger(trigger);
  }
}

function getOutreachSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty('OUTREACH_SPREADSHEET_ID', active.getId());
    return active;
  }
  const spreadsheetId = properties.getProperty('OUTREACH_SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Run setupOutreachSheets from the outreach spreadsheet before using the schedule.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function buildEmailBody_(row, sponsorPageUrl) {
  const organization = String(row.Organization || '').trim();
  const contactName = String(row['Contact name'] || '').trim();
  const greeting = contactName ? `Hi ${contactName},` : `Hello ${organization} team,`;
  const personalization = String(row['Personalization note'] || '').trim();
  const personalizationLine = personalization ? `\n${personalization}\n` : '\n';

  return `${greeting}${personalizationLine}
Thank you for your interest in Acalanes Data Fest. Here are the sponsorship details. Acalanes Data Science Club is organizing a free, student-run data science and AI hackathon for up to 50 Bay Area high school students, hosted by BRIDGEGOOD at its Oakland studio on Saturday, November 21, 2026, from 9 AM to 5 PM Pacific. Students will work in teams of 1–4 to explore real datasets, build projects, and present to judges. Beginners are welcome.

Suggested cash levels are $250 Community Sponsor, $500 Event Sponsor, $1,000 Lead Sponsor, and $2,500 Presenting Sponsor. In-kind support such as food, drinks, prizes, software, compute, or other project materials is welcome; a different amount or a combination of cash and in-kind support is welcome too. Contributions help cover event costs and keep participation free.

Cash sponsors receive standard recognition at Data Fest and Acalanes Data Science Club events for a year. Sponsor representatives may also join as judges or mentors. The top three teams are invited to showcase their work at BRIDGEGOOD’s Inspiration Awards at Salesforce Tower on December 11.

The sponsor page has the full event details and benefits: ${sponsorPageUrl}. I’ve attached the sponsorship packet as well. If one of these options could fit ${organization}, reply here and we can coordinate.

If you would prefer not to receive further sponsor updates, reply with “unsubscribe” and we’ll honor your request.

Thank you,
Data Science Leadership
Acalanes Data Science Club
Acalanes High School
1200 Pleasant Hill Road
Lafayette, CA 94549
leadership@ahsdata.com
https://ahsdata.com/`;
}

function seedScreenshotSuppressions_(sheet) {
  const existing = new Set(readRows_(sheet, SUPPRESSION_HEADERS).map(row => normalizeOrganization_(row.Organization)).filter(Boolean));
  const missing = OUTREACH.screenshotSuppressionNames
    .filter(name => !existing.has(normalizeOrganization_(name)))
    .map(name => [name, '', '', 'User-provided prior outreach screenshot', '']);
  if (missing.length) sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, SUPPRESSION_HEADERS.length).setValues(missing);
}

function seedSettings_(sheet) {
  const current = readSettings_(sheet);
  const rows = SETTINGS_DEFAULTS.filter(([key]) => current[key] === undefined);
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders_(sheet, expected) {
  if (!sheet.getLastRow() || !sheet.getLastColumn()) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
    return;
  }
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  if (headers.every(value => !value)) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
    return;
  }
  const missing = expected.filter(name => !headers.includes(name));
  if (missing.length) {
    sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

function readRows_(sheet, expectedHeaders) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map(row => Object.fromEntries(expectedHeaders.map(header => [header, row[headers.indexOf(header)]])));
}

function writeRows_(sheet, headers, rows) {
  if (!rows.length) return;
  const lastColumn = sheet.getLastColumn();
  const sheetHeaders = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const values = sheet.getRange(2, 1, rows.length, lastColumn).getValues();
  rows.forEach((row, rowIndex) => {
    headers.forEach(header => {
      values[rowIndex][sheetHeaders.indexOf(header)] = row[header] === undefined ? '' : row[header];
    });
  });
  sheet.getRange(2, 1, values.length, lastColumn).setValues(values);
}

function readSettings_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  return Object.fromEntries(sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues().filter(row => row[0]).map(row => [row[0].trim(), row[1].trim()]));
}

function normalizeEmail_(value) {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

function normalizeDomain_(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function domainFromEmail_(email) {
  const normalized = normalizeEmail_(email);
  return normalized ? normalized.split('@')[1] : '';
}

function isPersonalMailboxDomain_(domain) {
  return new Set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
    'protonmail.com', 'pm.me', 'fastmail.com', 'comcast.net', 'att.net', 'sbcglobal.net',
    'verizon.net', 'cox.net', 'yandex.com',
  ]).has(String(domain || '').toLowerCase());
}

function normalizeOrganization_(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function organizationMatches_(candidate, suppressed) {
  return candidate === suppressed || (suppressed.length >= 5 && candidate.includes(suppressed)) || (candidate.length >= 5 && suppressed.includes(candidate));
}

function splitAddresses_(header) {
  return String(header || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function isFromOurAccount_(header, addresses) {
  const sender = normalizeEmail_(header);
  return Boolean(sender && addresses.has(sender));
}

function subjectOrganization_(subject) {
  const text = String(subject || '').replace(/^(re|fw|fwd):\s*/i, '').trim();
  const match = text.match(/(?:^|\bx\s)([^|:]+?)(?:\s*[|:]|$)/i);
  return match ? match[1].trim() : text;
}

function positiveInteger_(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function appendNote_(current, addition) {
  const text = String(current || '').trim();
  return text ? `${text} ${addition}` : addition;
}
