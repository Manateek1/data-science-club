# Sponsor outreach drafts

This is a free Gmail + Google Sheets + Apps Script workflow for preparing reviewed sponsor emails. It creates drafts only. It has no send function, no follow-up sender, and no contact discovery or email scraping.

## What it does

- Runs five times a day at 9 AM, 11 AM, 1 PM, 3 PM, and 5 PM Pacific. Each run creates up to four Gmail drafts, with a hard limit of 20 per day.
- Uses `leadership@ahsdata.com` and the display name `Data Science Leadership`; copies the configured address in the Settings tab.
- Adds the current sponsorship PDF as an attachment and links to the public sponsor page.
- Requires each prospect row to say `CONFIRMED` in **Contact eligibility** and include **Eligibility evidence** before drafting. This means a person has checked the business is a relevant Bay Area prospect, the recipient is a published business or sponsorship contact, and the message is individually accurate. It does not treat a public address as consent to bulk mail.
- Suppresses the five organizations named in the user-provided prior-outreach screenshot, imports recipients from earlier Data Fest messages in Gmail, and checks organization, email, and domain duplicates.
- Marks created rows `DRAFTED` so another run cannot recreate the same message. After reviewing, send from Gmail yourself and fill in **Sent at** in the tracker.

## Install

1. Create a Google Sheet named **Acalanes Data Fest Sponsor Outreach** in the Gmail account that will hold drafts.
2. From the Sheet, open **Extensions → Apps Script**. Replace the starter code with `Code.gs` from this folder and save.
3. In Apps Script project settings, set the time zone to **America/Los_Angeles**.
4. Run `setupOutreachSheets` once and approve Google’s requested access. It creates `Prospects`, `Suppressions`, and `Settings` tabs. In `Settings`, fill **CC address** with the club’s requested copy address.
5. Run `importRecentSentHistory` once. Review `Suppressions` and add any earlier contacts that are not in Gmail’s sent history. The five companies from the supplied screenshot are already seeded by the script.
6. In Gmail, add and verify `leadership@ahsdata.com` under **Settings → Accounts and Import → Send mail as**. The name must show **Data Science Leadership**. Make sure replies to messages sent to this address use the same address.
7. Add one organization per row after reviewing the fit and a published business or sponsorship contact address. Record the public source and why the organization is a reasonable sponsor fit in **Eligibility evidence**. Add a specific, factual **Personalization note**; do not use guessed addresses, scraped personal addresses, or generic blast copy.
8. Run `installDraftTriggers` once. Check Gmail’s **Drafts** folder at the scheduled times, review each email and attachment, and click **Send** yourself. To stop creating drafts, choose **Sponsor outreach → Remove draft schedule**.

## Inbox and reply handling

Set up a free forwarding rule for `leadership@ahsdata.com` to the club’s personal mailbox. Incoming sponsor replies then appear in that Gmail **Inbox**. Open a reply and use **Reply**; Gmail should select `leadership@ahsdata.com` as the From address. Sent messages appear in Gmail **Sent** and can be searched with `from:leadership@ahsdata.com`.

The script deliberately does not send messages automatically. It creates drafts for eligible rows only; the user reviews and sends them. No contact is added by this code, and no email is sent during setup.

## Tracker columns

`Prospects` uses: Organization, Recipient email, Contact name, Personalization note, Contact eligibility, Eligibility evidence, Status, Draft ID, Draft created at, Sent at, and Notes. Set **Contact eligibility** to `CONFIRMED` only after checking that the organization is relevant, the recipient address is published for business inquiries, and the copy is individually accurate. A public address alone is not a reason to send repeated or bulk follow-ups. Honor any request to stop immediately.

`Suppressions` stores prior recipients and organizations, including companies from the screenshot and sent Data Fest email history. Add a recipient or company there after any opt-out, bounce, or decision not to contact again.
