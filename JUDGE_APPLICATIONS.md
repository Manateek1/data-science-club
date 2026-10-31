# Judge applications

The homepage links to `/judge`. Vite builds `judge.html` as a second entry;
`vercel.json` routes `/judge` and `/judge/` to it without changing the existing
GroupMe Cron schedules. This frontend does not require a new server or database.

## Receive applications with Formspree

The organizer's public endpoint, `https://formspree.io/f/mzeejrbr`, is configured
as the default in `src/judge.js`. No Vercel environment variable is needed.

1. In Formspree, open this form and verify the recipient email address. Check
   that email notifications are enabled and go to the organizer's intended inbox.
2. Deploy these repository changes to the existing Vercel project for
   `ahsdata.com`, using the normal production deployment process.
3. If replacing the endpoint later, optionally set `VITE_JUDGE_FORM_ENDPOINT`
   in Vercel for Production (and Preview if desired), then redeploy. An existing
   override takes precedence over the default, so remove any stale override.
   Vite reads this variable at build time; changing it requires a new deployment.
   The endpoint is public, not an account API key. Never put passwords, account
   API keys, or other secrets in a `VITE_` variable. For a local override:

   ```bash
   VITE_JUDGE_FORM_ENDPOINT=https://formspree.io/f/YOUR_FORM_ID npm run dev
   ```

4. Submit one application you control from the deployed `https://ahsdata.com/judge`.
   Confirm both the notification email and the entry in Formspree's submissions
   dashboard. Check spam if the notification is missing. An email application's
   Reply action should address the applicant using the form's `email` field;
   verify this on your first submission.
5. Check the free plan's current submission allowance and retention settings
   in your Formspree account. Monitor usage while recruiting; limits and service
   terms can change. Configure any available spam or domain restrictions for
   `ahsdata.com` (and preview domains if needed).

The free plan is intended for a small application form. Official plan details:
https://formspree.io/plans. Plan limits were not independently verified during
implementation because that page rejected automated access. No paid plan is
required by the code. Formspree accounts, email verification, and production
email delivery must be completed by the organizer; code alone cannot enable them.

## Behavior and privacy

- If the configured endpoint is empty or invalid, the form shows an unavailable notice and
  stays disabled rather than claiming to accept applications.
- The form collects name, email, an optional LinkedIn/website URL, relevant
  experience, availability, and consent to judging-related contact.
- Browser validation checks required fields, email, URL, and consent. A honeypot
  is included for Formspree spam filtering; provider spam protection should also
  remain enabled. No file uploads or custom backend are needed.
- Submissions go directly over HTTPS to Formspree. The site does not store them
  in browser storage or log applicant answers. Formspree processes and stores
  the information under its privacy policy, linked beside the consent checkbox.
- The page confirms receipt only after a successful provider response. If the
  request fails, answers remain in the form for retry. An ambiguous network
  timeout can mean the provider received a submission, so duplicates are possible.
- Restrict dashboard access to organizers and delete applicant information when
  it is no longer needed. Email notification delivery is managed by Formspree;
  a successful HTTP response does not verify inbox delivery.

## Validation

Run `npm ci` and `npm run build`. Check `/judge` on the Vite development server,
and `dist/judge.html` through production preview. Vercel rewrites take effect on
Vercel, not Vite preview; `/judge.html` is available for local preview checks.
Check desktop/mobile layout, required fields, consent, successful submissions,
and provider/network error recovery. Use intercepted requests for development
checks to avoid sending real applications. A real delivery test is still needed
once the organizer connects the endpoint and deploys.
