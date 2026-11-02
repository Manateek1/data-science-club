# Sponsor outreach drafts

This is a free Gmail + Google Sheets + Apps Script workflow for preparing reviewed sponsor emails. It creates drafts only. It has no send function, no follow-up sender, and no contact discovery or email scraping.

## What it does

- Runs five times a day at 9 AM, 11 AM, 1 PM, 3 PM, and 5 PM Pacific. Each run creates up to four Gmail drafts, with a hard limit of 20 per day.
- Uses `leadership@ahsdata.com` and the display name `Data Science Leadership`; copies the configured address in the Settings tab.
- Adds the current sponsorship PDF as an attachment and links to the public sponsor page.
- Requires a prospect row to pass two separate checks before drafting: `CONFIRMED` in **Contact eligibility** for sponsor fit and a published business contact, and `OPTED_IN` in **Consent status** with dated **Consent evidence** that the recipient explicitly requested sponsorship information or opted in. Resend prohibits unsolicited email, including cold outreach; a public business address and manual review are not consent.
- Suppresses the five organizations named in the user-provided prior-outreach screenshot, imports recipients from earlier Data Fest messages in Gmail, and checks organization, email, and domain duplicates.
- Marks created rows `DRAFTED` so another run cannot recreate the same message. After reviewing, send from Gmail yourself and fill in **Sent at** in the tracker.

## Install

1. Create or open the Google Sheet named **Acalanes Data Fest Sponsor Outreach** in the Gmail account that will hold drafts.
2. From the Sheet, open **Extensions → Apps Script**. Replace the starter code with `Code.gs` from this folder and save.
3. In Apps Script project settings, set the time zone to **America/Los_Angeles**.
4. Run `setupOutreachSheets` once and approve Google’s requested access. It creates `Prospects`, `Suppressions`, and `Settings` tabs. On an existing tracker it appends the consent columns without moving current data. In `Settings`, fill **CC address** with `yeedoreal@gmail.com`.
5. Run `importRecentSentHistory` once. Review `Suppressions` and add any earlier contacts that are not in Gmail’s sent history. The five companies from the supplied screenshot are already seeded by the script.
6. Verify `ahsdata.com` in Resend. In Gmail, add and verify `leadership@ahsdata.com` under **Settings → Accounts and Import → Send mail as**. Use the name **Data Science Leadership** and Resend SMTP settings: host `smtp.resend.com`, port `465`, username `resend`, SSL, and a Resend **sending-access** API key restricted to `ahsdata.com`. Do not paste the API key into the tracker or this repository.
7. Add one organization per row only after the recipient explicitly requests sponsorship information or opts in to receive it. Set **Contact eligibility** to `CONFIRMED` only after checking sponsor fit, the published business contact, and message accuracy. Set **Consent status** to `OPTED_IN` and record the dated source and exact request or opt-in in **Consent evidence**. A public email address alone does not qualify. Add a specific, factual **Personalization note**.
8. Run `installDraftTriggers` once. Check Gmail’s **Drafts** folder at the scheduled times, review each email and attachment, and click **Send** yourself. To stop creating drafts, choose **Sponsor outreach → Remove draft schedule**.

## Inbox and reply handling

Set up a free forwarding rule for `leadership@ahsdata.com` to `yeedoreal@gmail.com`. Incoming sponsor replies then appear in that Gmail **Inbox**. Open a reply and use **Reply**; Gmail should select `leadership@ahsdata.com` as the From address. Sent messages appear in Gmail **Sent** and can be searched with `from:leadership@ahsdata.com`. Messages relayed through Resend also appear in Resend **Emails**.

Google currently says Gmail will remove third-party **Send mail as** support in January 2027. Treat the Gmail alias as a short-term bridge and move to a mail client that supports custom SMTP before then if this workflow continues.

The script deliberately does not send messages automatically. It creates drafts only for explicitly opted-in or requesting contacts; the user reviews and sends them. No contact is added by this code, and no email is sent during setup.

## Tracker columns

`Prospects` uses: Organization, Recipient email, Contact name, Personalization note, Contact eligibility, Eligibility evidence, Status, Draft ID, Draft created at, Sent at, Notes, Consent status, and Consent evidence. `CONFIRMED` checks sponsor fit and contact accuracy; `OPTED_IN` separately records explicit permission or a direct request for sponsorship information. Record the date and source. A public address, a guess, or a prior unrelated contact is not consent. Honor opt-outs immediately and add them to `Suppressions`.

`Suppressions` stores prior recipients and organizations, including companies from the screenshot and sent Data Fest email history. Add a recipient or company there after any opt-out, bounce, or decision not to contact again.
