# Sponsor page and prospectus

`/sponsor` is a static, responsive Vite entry (`sponsor.html`), with Vercel rewrites for `/sponsor` and `/sponsor/`. The homepage sponsor section links to it. Its browser-viewable PDF is `public/acalanes-data-fest-sponsorship.pdf`. The prospectus link opens a new tab; Vercel serves it with inline content disposition.

## Update the PDF

The PDF prints the sponsor page itself with its print stylesheet so the two share their content. After editing the page or styles:

```sh
npm ci
npm run prospectus
npm run build
```

PDF generation requires Node 24 and Chromium (available in the prepared environment). Set `CHROMIUM_PATH` to select another Chromium executable. The helper starts an isolated local Vite server on port 5184, prints with Chromium's DevTools API, and stops its own processes. Run it in a context that permits local listening sockets and browser startup. The PDF remains a checked-in static asset; ordinary builds and Vercel deployment do not need Chromium. Always regenerate the PDF before building after a content change.

Inspect the generated PDF for page breaks and clipping. Expected output: one A4 page with the event essentials, sponsor benefits, contribution options, and contact details. `npm run preview` serves `/sponsor.html`; extensionless production paths depend on the Vercel rewrites.

## Content decisions

The organizer-provided Dillon Nagar / Shaun Tai conversation through November 1, 2026 is the source for event details. The raw conversation is not included in the site or PDF.

- The November 1 approval of 50 individual registrations supersedes the earlier 48-student / 12-team plan. Team sizes remain 1–4; more than 12 teams are allowed. Homepage FAQ updated accordingly.
- November 21, 9 AM–5 PM is the agreed event window. The prospectus omits the detailed participant agenda.
- The December 11 Inspiration Awards opportunity is a poster showcase for the top three teams. Sponsor content highlights the student outcome and audience; poster specifications, deadlines, ticket values, and parent attendance requirements are omitted.
- BRIDGEGOOD is credited as host, and Acalanes Data Science Club as organizer. Rental valuations, equipment inventories, setup/cleanup instructions, insurance, and internal responsibilities are omitted from sponsor materials.
- The organizer subsequently confirmed Data Fest sponsorship with sponsor mentions at the hackathon, plus a full year of club sponsorship after the event with mentions at every club event until sponsorship ends November 21, 2027. Sponsors also receive frequent mentions at weekly club meetings at Acalanes High School and may optionally send representatives to Data Fest as judges, mentors, or both. These benefits are stated in both the page and PDF. Frequent mentions do not promise a mention at every meeting.
- The source conversation contains no tier prices, payment instructions, fundraising goal, tax-deductibility statement, or sponsor access to the December event. On November 2, 2026, club leadership approved displaying these suggested contribution levels: in-kind support, $250 Community Sponsor, $500 Event Sponsor, $1,000 Lead Sponsor, and $2,500 Presenting Sponsor. A different amount or combined in-kind contribution is welcome.
- The same existing recognition and optional judging/mentoring language applies across the cash levels. No extra benefits are assigned to a particular amount. Do not add tax-deductibility, payment instructions, a fundraising goal, or sponsor access to the December event without separate confirmation.
- Sponsor inquiries go to `leadership@ahsdata.com`, signed as Data Science Leadership. Other participants' contact details and personal phone numbers are omitted from public sponsor materials.

The sponsor page does not collect payments or create sponsor commitments. The downloadable prospectus is generated from the page's print stylesheet so the published facts and contribution levels match.
